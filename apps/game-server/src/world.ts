import { DurableObject } from 'cloudflare:workers';

import {
  DEFAULT_WORLD_SEED,
  HEALTH_MAX,
  MAX_PLAYERS_PER_WORLD,
  SAVE_INTERVAL_TICKS,
  SLOW_TICK_BUDGET_MS,
  SNAPSHOT_EVERY_N_TICKS,
  TICK_MILLISECONDS,
  RejectReason,
  WorldSimulation,
  buildableKindFromIndex,
  buildableKindIndex,
  decodeClientMessage,
  encodeInventory,
  encodePickupsTaken,
  encodePlayerLeft,
  encodePong,
  encodeBuiltProps,
  encodeCaught,
  encodeCrafted,
  encodeFishing,
  encodeHealth,
  encodeHunger,
  encodeRejected,
  encodeSnapshot,
  encodeThreatHit,
  encodeTreeHit,
  encodeTreeStates,
  encodeWelcome,
  inventoryEntries,
  itemFromIndex,
  itemIndex,
  type BuiltProp,
  type ItemId,
  type PersistedPlayer,
  type PersistedTree,
  type SnapshotEntity,
} from '@acorn/shared';

import type { WorldEnv } from './env';

/** What we keep on a WebSocket so it survives the object going to sleep. */
interface ConnectionAttachment {
  readonly netId: number;
  /** Identifies the player between visits. Phase 1 replaces this with a real account. */
  readonly playerKey: string | null;
}

/** A player key is supplied by the client, so it is checked before it is trusted. */
const PLAYER_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * One world.
 *
 * The object wakes when the first player connects, runs a 20 Hz tick loop while
 * anyone is connected, saves every 30 seconds and when the last player leaves,
 * and then clears its timers so it can go back to sleep. Timers prevent
 * hibernation and cost money, so the loop must never outlive the last player.
 */
export class World extends DurableObject<WorldEnv> {
  private simulation: WorldSimulation | null = null;
  private tickHandle: ReturnType<typeof setInterval> | null = null;
  private nextNetId = 1;

  /** Reused between ticks so a busy world does not allocate per player. */
  private readonly snapshotScratch: SnapshotEntity[] = [];

  /** When the previous tick ran, used to notice the loop falling behind. */
  private lastTickAtMs = 0;
  private slowTickCount = 0;

  constructor(ctx: DurableObjectState, env: WorldEnv) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      this.createSchema();
    });
  }

  /* ---------------------------------------------------------------------- */
  /* Connecting                                                             */
  /* ---------------------------------------------------------------------- */

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.endsWith('/status')) {
      return Response.json(this.status());
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('This endpoint speaks WebSocket.', { status: 426 });
    }

    const simulation = this.ensureSimulation();
    if (simulation.playerCount >= MAX_PLAYERS_PER_WORLD) {
      const { 0: client, 1: server } = new WebSocketPair();
      server.accept();
      server.send(encodeRejected(RejectReason.WorldFull));
      server.close(4001, 'This world is full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const requestedKey = url.searchParams.get('player');
    const playerKey =
      requestedKey !== null && PLAYER_KEY_PATTERN.test(requestedKey) ? requestedKey : null;

    const netId = this.claimNetId();
    const { 0: client, 1: server } = new WebSocketPair();

    // Hibernatable sockets: the runtime can put this object to sleep and wake it
    // when a message arrives, instead of us holding it open.
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ netId, playerKey } satisfies ConnectionAttachment);

    simulation.addPlayer(netId, playerKey ? this.loadPlayer(playerKey) : undefined, playerKey);
    server.send(encodeWelcome(netId, simulation.seed, simulation.tick, this.worldTimeMs()));
    // What you are carrying, and what is no longer lying about to be found.
    server.send(encodeInventory(inventoryEntries(simulation.inventoryOf(netId))));
    server.send(encodePickupsTaken(simulation.takenPickupIds()));
    server.send(encodeTreeStates(simulation.changedTrees()));
    server.send(encodeBuiltProps(simulation.builtPropsList()));
    server.send(encodeHunger({ netId, hunger: simulation.hungerOf(netId), ate: null }));
    server.send(
      encodeHealth({ netId, health: simulation.healthOf(netId), knockedOut: false }),
    );
    this.startTicking();

    return new Response(null, { status: 101, webSocket: client });
  }

  /* ---------------------------------------------------------------------- */
  /* Talking to players                                                     */
  /* ---------------------------------------------------------------------- */

  override webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): void {
    // The protocol is binary. Anything else is somebody poking at us.
    if (typeof message === 'string') return;

    const attachment = this.attachmentFor(ws);
    if (attachment === null) return;

    const decoded = decodeClientMessage(message);
    if (decoded === null) {
      ws.send(encodeRejected(RejectReason.BadMessage));
      return;
    }

    const simulation = this.ensureSimulation();
    if (decoded.type === 'input') {
      // The simulation clamps and validates every one of these. The client is
      // telling us what it pressed, never where it ended up.
      simulation.queueInputs(attachment.netId, decoded.inputs);
      return;
    }
    if (decoded.type === 'craft') {
      // Not tied to reach or the tick loop the way chopping and picking
      // things up are, so it is settled the moment it arrives rather than
      // waiting for the next step.
      simulation.craftItem(attachment.netId, decoded.item);
      this.announceCrafting(simulation);
      return;
    }
    if (decoded.type === 'build') {
      // Unlike crafting this still depends on where the player is and which
      // way they are facing, so it waits for the next tick rather than
      // settling immediately - the tick loop already has both to hand.
      simulation.requestBuild(attachment.netId, decoded.kind);
      return;
    }
    ws.send(encodePong(decoded.clientTimeMs, this.worldTimeMs()));
  }

  override webSocketClose(ws: WebSocket): void {
    this.dropConnection(ws);
  }

  override webSocketError(ws: WebSocket): void {
    this.dropConnection(ws);
  }

  private dropConnection(ws: WebSocket): void {
    const attachment = this.attachmentFor(ws);
    if (attachment === null) return;

    const simulation = this.simulation;
    if (simulation !== null) {
      this.savePlayer(simulation, attachment);
      simulation.removePlayer(attachment.netId);
      this.broadcast(encodePlayerLeft(attachment.netId), ws);

      if (simulation.playerCount === 0) {
        // Last one out saves the world and turns off the lights: a timer left
        // running would keep this object awake and billable forever.
        this.save(simulation);
        this.stopTicking();
        this.releaseSimulation();
      }
    }
  }

  /* ---------------------------------------------------------------------- */
  /* The tick loop                                                          */
  /* ---------------------------------------------------------------------- */

  private startTicking(): void {
    if (this.tickHandle !== null) return;
    this.lastTickAtMs = Date.now();
    this.tickHandle = setInterval(() => this.runTick(), TICK_MILLISECONDS);
  }

  private stopTicking(): void {
    if (this.tickHandle === null) return;
    clearInterval(this.tickHandle);
    this.tickHandle = null;
  }

  private runTick(): void {
    const simulation = this.simulation;
    if (simulation === null) {
      this.stopTicking();
      return;
    }
    if (simulation.playerCount === 0) {
      this.stopTicking();
      return;
    }

    // Workers freeze the clock between I/O, so this measures the gap from one
    // tick to the next rather than the CPU one tick used. That is the number we
    // actually care about: if it grows past the budget the loop is falling behind.
    const startedAt = Date.now();
    const sinceLastTick = startedAt - this.lastTickAtMs;
    this.lastTickAtMs = startedAt;

    simulation.step(startedAt);
    this.announcePickups(simulation);
    this.announceGathering(simulation);
    this.announceChopping(simulation);
    this.announceCatching(simulation);
    this.announceThreatHits(simulation);
    this.announceBuilding(simulation);
    this.announceFishing(simulation);
    this.announceHunger(simulation);
    this.announceHealth(simulation);
    this.announceRegrowth(simulation, startedAt);

    if (simulation.tick % SNAPSHOT_EVERY_N_TICKS === 0) {
      this.broadcastSnapshots(simulation);
    }

    if (simulation.tick % SAVE_INTERVAL_TICKS === 0) {
      this.save(simulation);
    }

    const overrun = sinceLastTick - TICK_MILLISECONDS;
    if (overrun > SLOW_TICK_BUDGET_MS) {
      this.slowTickCount += 1;
      // Only shout occasionally, so a struggling world does not drown the logs.
      if (this.slowTickCount % 20 === 1) {
        console.warn(
          `Slow tick: ${sinceLastTick.toFixed(1)} ms between ticks ` +
            `(budget ${TICK_MILLISECONDS} ms, ${simulation.playerCount} players, ` +
            `${this.slowTickCount} slow ticks so far)`,
        );
      }
    }
  }

  /**
   * Tell everybody about anything that was picked up this tick.
   *
   * The taker is told what they now carry, everybody is told the thing is gone,
   * and it is written to storage straight away rather than waiting for the next
   * save: finding the axe is not something anybody should have to do twice.
   */
  private announcePickups(simulation: WorldSimulation): void {
    const events = simulation.drainPickupEvents();
    if (events.length === 0) return;

    for (const event of events) this.writeTakenPickup(event.pickupId, event.netId);

    const takenMessage = encodePickupsTaken(simulation.takenPickupIds());
    const takers = new Set(events.map((event) => event.netId));

    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      this.trySend(ws, takenMessage);
      if (!takers.has(attachment.netId)) continue;

      const items = inventoryEntries(simulation.inventoryOf(attachment.netId));
      this.trySend(ws, encodeInventory(items));
      if (attachment.playerKey !== null) this.writePlayerItems(attachment.playerKey, items);
    }
  }

  /**
   * Tell anybody who gathered a stick this tick what is in their pack now.
   *
   * Unlike a pickup, a gather spot never runs out, so there is nothing here
   * for everybody else to be told about.
   */
  private announceGathering(simulation: WorldSimulation): void {
    const netIds = simulation.drainGatherEvents();
    if (netIds.length === 0) return;
    this.sendPacks(simulation, new Set(netIds));
  }

  /**
   * Tell everybody about every swing that landed this tick.
   *
   * Each hit goes to everyone so a tree can shake for whoever is watching, not
   * just for whoever is swinging. A tree that came down is written to storage
   * straight away, along with the logs it paid out, rather than waiting for the
   * next save: nobody should have to chop the same tree twice.
   */
  private announceChopping(simulation: WorldSimulation): void {
    const events = simulation.drainChopEvents();
    if (events.length === 0) return;

    const choppers = new Set<number>();
    let anythingFell = false;
    for (const event of events) {
      this.broadcast(encodeTreeHit(event.treeId, event.swingsLeft));
      if (event.swingsLeft === 0) anythingFell = true;
      if (event.logsGained > 0) choppers.add(event.netId);
    }

    if (anythingFell) {
      // Sending the whole list is cheap while a clearing has a hundred and
      // forty trees; a bigger world would want to send only what changed.
      this.broadcast(encodeTreeStates(simulation.changedTrees()));
    }

    // Only the trees that are down or part cut, which is a short list.
    for (const tree of simulation.persistableTrees()) this.writeTree(tree);

    this.sendPacks(simulation, choppers);
  }

  /**
   * Tell a player what they just caught, for a HUD toast, then send their
   * pack afterwards the same as any other way it changes.
   *
   * Private to the one who caught it: like crafting, nobody else has any
   * reason to know what somebody else just caught. The animal itself
   * vanishing is already plain to everybody from the next snapshot.
   */
  private announceCatching(simulation: WorldSimulation): void {
    const events = simulation.drainCatchEvents();
    if (events.length === 0) return;

    const byNetId = new Map(events.map((event) => [event.netId, event]));
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const event = byNetId.get(attachment.netId);
      if (event !== undefined) this.trySend(ws, encodeCaught(event));
    }
    this.sendPacks(simulation, new Set(byNetId.keys()));
  }

  /**
   * Tell everybody a threat got hit without going down, or came back from
   * being defeated - the same reason a tree hit goes to everybody, not just
   * whoever is swinging.
   */
  private announceThreatHits(simulation: WorldSimulation): void {
    const events = simulation.drainThreatHitEvents();
    for (const event of events) this.broadcast(encodeThreatHit(event));
  }

  /**
   * Tell everybody about anything placed this tick, and write it to storage
   * straight away: nobody should have to build the same campfire twice.
   *
   * Sent to everybody, unlike a catch or a craft, because a build changes
   * the world itself, not just one player's pack - the same reason a felled
   * tree goes out to everybody too.
   */
  private announceBuilding(simulation: WorldSimulation): void {
    const events = simulation.drainBuildEvents();
    if (events.length === 0) return;

    for (const event of events) this.writeBuiltProp(event.prop, event.ownerKey);
    this.broadcast(encodeBuiltProps(simulation.builtPropsList()));
    this.sendPacks(simulation, new Set(events.map((event) => event.netId)));
  }

  /**
   * Tell everybody what happened at the water, and tell whoever landed a fish
   * what is in their pack now.
   */
  private announceFishing(simulation: WorldSimulation): void {
    const events = simulation.drainFishingEvents();
    if (events.length === 0) return;

    const landed = new Set<number>();
    for (const event of events) {
      this.broadcast(encodeFishing(event));
      if (event.kind === 'caught' && event.added > 0) landed.add(event.netId);
    }
    this.sendPacks(simulation, landed);
  }

  /**
   * Tell each player what just happened to their own hunger.
   *
   * Private to the one it happened to: nobody else's business how hungry
   * anybody else is, or what they just ate.
   */
  private announceHunger(simulation: WorldSimulation): void {
    const events = simulation.drainHungerEvents();
    if (events.length === 0) return;

    const byNetId = new Map(events.map((event) => [event.netId, event]));
    const ate = new Set<number>();
    for (const event of events) if (event.ate !== null) ate.add(event.netId);

    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const event = byNetId.get(attachment.netId);
      if (event !== undefined) this.trySend(ws, encodeHunger(event));
    }
    // Eating took something out of the pack; say so, the same as any other
    // way a pack changes.
    this.sendPacks(simulation, ate);
  }

  /**
   * Tell each player what just happened to their own health.
   *
   * Private to the one it happened to, the same reason hunger is: nobody
   * else's business how hurt anybody else is. A knockout's new position
   * needs no message of its own - it is already in the next snapshot.
   */
  private announceHealth(simulation: WorldSimulation): void {
    const events = simulation.drainHealthEvents();
    if (events.length === 0) return;

    const byNetId = new Map(events.map((event) => [event.netId, event]));
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const event = byNetId.get(attachment.netId);
      if (event !== undefined) this.trySend(ws, encodeHealth(event));
    }
  }

  /**
   * Tell a player what they just made, for a HUD toast, then send their pack
   * afterwards the same as any other way it changes.
   *
   * Private to the one who made it: nobody else has any reason to know what
   * somebody else just crafted.
   */
  private announceCrafting(simulation: WorldSimulation): void {
    const events = simulation.drainCraftEvents();
    if (events.length === 0) return;

    const byNetId = new Map(events.map((event) => [event.netId, event]));
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const event = byNetId.get(attachment.netId);
      if (event !== undefined) this.trySend(ws, encodeCrafted(event));
    }
    this.sendPacks(simulation, new Set(byNetId.keys()));
  }

  /** Send these players their packs, and save them straight away. */
  private sendPacks(simulation: WorldSimulation, netIds: ReadonlySet<number>): void {
    if (netIds.size === 0) return;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null || !netIds.has(attachment.netId)) continue;
      const items = inventoryEntries(simulation.inventoryOf(attachment.netId));
      this.trySend(ws, encodeInventory(items));
      if (attachment.playerKey !== null) this.writePlayerItems(attachment.playerKey, items);
    }
  }

  /**
   * Bring back anything whose time is up, and say so.
   *
   * Checked every tick because the check is cheap: it walks only the trees
   * somebody has touched, and skips the ones that are not due. The important
   * run is the first one after a world wakes, when everything felled while
   * nobody was here comes back at once.
   */
  private announceRegrowth(simulation: WorldSimulation, nowMs: number): void {
    const grown = simulation.regrowTrees(nowMs);
    if (grown.length === 0) return;

    this.broadcast(encodeTreeStates(simulation.changedTrees()));
    for (const tree of simulation.persistableTrees()) this.writeTree(tree);
  }

  private broadcastSnapshots(simulation: WorldSimulation): void {
    const serverTimeMs = this.worldTimeMs();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      // Each player gets their own snapshot: they only hear about entities near
      // them, and the acknowledged input number is theirs alone.
      const entities = simulation.snapshotFor(attachment.netId, this.snapshotScratch);
      this.trySend(
        ws,
        encodeSnapshot(
          simulation.tick,
          serverTimeMs,
          simulation.lastProcessedSeq(attachment.netId),
          entities,
        ),
      );
    }
  }

  private broadcast(payload: ArrayBuffer, except?: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      this.trySend(ws, payload);
    }
  }

  private trySend(ws: WebSocket, payload: ArrayBuffer): void {
    try {
      ws.send(payload);
    } catch {
      // The socket went away between us listing it and sending. The close
      // handler will tidy up; there is nothing useful to do here.
    }
  }

  /* ---------------------------------------------------------------------- */
  /* State                                                                  */
  /* ---------------------------------------------------------------------- */

  /**
   * Let go of the empty world.
   *
   * Koota hands out a fixed number of ECS worlds per isolate, and Durable
   * Objects share isolates, so a server that never gave one back would stop
   * being able to open new worlds after a couple of dozen. An empty world is
   * about to hibernate anyway, and `ensureSimulation` rebuilds it from storage
   * and the live sockets when somebody next knocks.
   */
  private releaseSimulation(): void {
    this.simulation?.dispose();
    this.simulation = null;
  }

  /**
   * Get the simulation, rebuilding it if this object was restarted.
   *
   * A Durable Object can be evicted and woken again with its sockets intact, so
   * the in-memory world has to be reconstructible from the sockets and storage.
   */
  private ensureSimulation(): WorldSimulation {
    if (this.simulation !== null) return this.simulation;

    const simulation = new WorldSimulation({
      seed: this.seed(),
      regrowMinSeconds: this.regrowMinSeconds(),
      hungerEmptyAfterSeconds: this.hungerEmptyAfterSeconds(),
    });
    this.simulation = simulation;
    simulation.restoreTakenPickups(this.loadTakenPickups());
    simulation.restoreTrees(this.loadTrees());
    simulation.restoreBuiltProps(this.loadBuiltProps());

    let highestNetId = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      simulation.addPlayer(
        attachment.netId,
        attachment.playerKey ? this.loadPlayer(attachment.playerKey) : undefined,
        attachment.playerKey,
      );
      highestNetId = Math.max(highestNetId, attachment.netId);
    }
    this.nextNetId = highestNetId + 1;

    simulation.tick = this.loadTick();
    // A sleeping world counts nothing, so anything due back is brought back
    // here, before the first snapshot goes out. Otherwise somebody walking in
    // an hour later would be shown the stump they left and then watch it turn
    // into a tree a tick afterwards.
    this.announceRegrowth(simulation, Date.now());
    if (simulation.playerCount > 0) this.startTicking();
    return simulation;
  }

  private seed(): number {
    const stored = this.readMeta('seed');
    if (stored !== null) return Number(stored);

    const configured = this.env.WORLD_SEED;
    const seed =
      configured !== undefined && Number.isFinite(Number(configured))
        ? Number(configured) >>> 0
        : DEFAULT_WORLD_SEED;
    this.writeMeta('seed', String(seed));
    return seed;
  }

  /**
   * How long a felled tree takes to come back, if the environment says.
   *
   * Only honoured when it is a sensible positive number, so a typo in a
   * dashboard variable cannot make every tree return instantly.
   */
  private regrowMinSeconds(): number | undefined {
    const configured = Number(this.env.WORLD_REGROW_SECONDS);
    if (!Number.isFinite(configured) || configured <= 0) return undefined;
    return configured;
  }

  /**
   * How long a full hunger meter takes to run out, if the environment says.
   *
   * Only honoured when it is a sensible positive number, so a typo in a
   * dashboard variable cannot make hunger run out instantly.
   */
  private hungerEmptyAfterSeconds(): number | undefined {
    const configured = Number(this.env.WORLD_HUNGER_EMPTY_SECONDS);
    if (!Number.isFinite(configured) || configured <= 0) return undefined;
    return configured;
  }

  /** Time since the world began, derived from the tick count rather than a clock. */
  private worldTimeMs(): number {
    const tick = this.simulation?.tick ?? 0;
    return Math.round(tick * TICK_MILLISECONDS) >>> 0;
  }

  private claimNetId(): number {
    const simulation = this.simulation;
    for (let attempt = 0; attempt < 65535; attempt++) {
      // Network ids travel as 16 bits and 0 means "nobody".
      const candidate = this.nextNetId;
      this.nextNetId = this.nextNetId >= 65535 ? 1 : this.nextNetId + 1;
      if (simulation === null || !simulation.hasPlayer(candidate)) return candidate;
    }
    throw new Error('Ran out of network ids');
  }

  private attachmentFor(ws: WebSocket): ConnectionAttachment | null {
    const attachment = ws.deserializeAttachment() as ConnectionAttachment | null | undefined;
    if (attachment == null || typeof attachment.netId !== 'number') return null;
    return attachment;
  }

  /* ---------------------------------------------------------------------- */
  /* Storage                                                                */
  /* ---------------------------------------------------------------------- */

  private createSchema(): void {
    const sql = this.ctx.storage.sql;
    sql.exec(`CREATE TABLE IF NOT EXISTS world_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`);
    sql.exec(`CREATE TABLE IF NOT EXISTS players (
      player_key TEXT PRIMARY KEY,
      x REAL NOT NULL,
      y REAL NOT NULL,
      z REAL NOT NULL,
      facing_yaw REAL NOT NULL,
      -- How hungry they were when last saved. A hundred is full; see HUNGER_MAX.
      hunger REAL NOT NULL DEFAULT 100,
      -- Health when last saved. A hundred is full; see HEALTH_MAX.
      health REAL NOT NULL DEFAULT 100,
      updated_at INTEGER NOT NULL
    )`);
    // What each player is carrying. One row per kind of thing they hold.
    sql.exec(`CREATE TABLE IF NOT EXISTS player_items (
      player_key TEXT NOT NULL,
      item_index INTEGER NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (player_key, item_index)
    )`);
    // Things somebody has taken out of the world. The clearing itself is built
    // from the seed, so only what has changed since has to be stored.
    sql.exec(`CREATE TABLE IF NOT EXISTS pickups_taken (
      pickup_id INTEGER PRIMARY KEY,
      net_id INTEGER NOT NULL,
      taken_at INTEGER NOT NULL
    )`);
    // Trees that are down, and trees somebody has started on. The clearing
    // itself comes from the seed, so only what has changed is stored.
    sql.exec(`CREATE TABLE IF NOT EXISTS trees (
      tree_id INTEGER PRIMARY KEY,
      swings_taken INTEGER NOT NULL,
      felled INTEGER NOT NULL,
      -- Real time, not ticks: a world with nobody in it does not tick, and a
      -- tree felled before bed still has to be back by morning.
      felled_at_ms INTEGER NOT NULL DEFAULT 0,
      -- How many times this spot has grown back. It decides the tree's size.
      generation INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )`);
    // A world somebody already played in has the table as it was then, because
    // "create if it does not exist" leaves an existing one alone. Worlds are
    // not thrown away between releases, so anything added later has to be added
    // to them here.
    this.addColumn('trees', 'felled_at_ms', 'INTEGER NOT NULL DEFAULT 0');
    this.addColumn('trees', 'generation', 'INTEGER NOT NULL DEFAULT 0');
    // A player saved before this release has no hunger on record. The default
    // above starts them full, same as anybody arriving fresh.
    this.addColumn('players', 'hunger', 'REAL NOT NULL DEFAULT 100');
    // Likewise health, added when knockout shipped: nobody was ever hurt
    // before that, so full is the only sensible default here too.
    this.addColumn('players', 'health', 'REAL NOT NULL DEFAULT 100');
    // A tree felled before this release has no record of when it fell. Count it
    // as having just come down, so an old clearing heals over the next half
    // hour instead of every stump popping back the moment somebody walks in.
    sql.exec('UPDATE trees SET felled_at_ms = ? WHERE felled = 1 AND felled_at_ms = 0', Date.now());
    // Everything anybody has placed. Nothing is ever removed from it yet, so
    // unlike trees and pickups there is no need to reconcile it against a seed.
    sql.exec(`CREATE TABLE IF NOT EXISTS built_props (
      id INTEGER PRIMARY KEY,
      kind_index INTEGER NOT NULL,
      x REAL NOT NULL,
      z REAL NOT NULL,
      built_at_ms INTEGER NOT NULL
    )`);
    // A cabin remembers whose it is, so its owner can start there next time.
    // Nothing built before homes existed had an owner - null leaves it exactly
    // as communal as it always was.
    this.addColumn('built_props', 'owner_key', 'TEXT');
  }

  /** Add a column to an existing table, unless it is already there. */
  private addColumn(table: string, column: string, definition: string): void {
    const sql = this.ctx.storage.sql;
    const columns = sql
      .exec<{ name: string }>('SELECT name FROM pragma_table_info(?)', table)
      .toArray();
    if (columns.some((row) => row.name === column)) return;
    // The names are ours, not anybody's input, so they can go in as text: SQLite
    // will not take a placeholder for a column name.
    sql.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }

  private readMeta(key: string): string | null {
    const rows = this.ctx.storage.sql
      .exec<{ value: string }>('SELECT value FROM world_meta WHERE key = ?', key)
      .toArray();
    return rows[0]?.value ?? null;
  }

  private writeMeta(key: string, value: string): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO world_meta (key, value) VALUES (?, ?) ' +
        'ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }

  private loadTick(): number {
    const stored = this.readMeta('tick');
    return stored === null ? 0 : Number(stored);
  }

  private loadPlayer(playerKey: string): PersistedPlayer | undefined {
    const rows = this.ctx.storage.sql
      .exec<{
        x: number;
        y: number;
        z: number;
        facing_yaw: number;
        hunger: number;
        health: number;
      }>(
        'SELECT x, y, z, facing_yaw, hunger, health FROM players WHERE player_key = ?',
        playerKey,
      )
      .toArray();
    const row = rows[0];
    if (row === undefined) return undefined;
    return {
      netId: 0,
      x: row.x,
      y: row.y,
      z: row.z,
      facingYaw: row.facing_yaw,
      items: this.loadPlayerItems(playerKey),
      hunger: row.hunger,
      health: row.health,
    };
  }

  private loadPlayerItems(playerKey: string): { item: ItemId; count: number }[] {
    const rows = this.ctx.storage.sql
      .exec<{
        item_index: number;
        count: number;
      }>('SELECT item_index, count FROM player_items WHERE player_key = ?', playerKey)
      .toArray();

    const items: { item: ItemId; count: number }[] = [];
    for (const row of rows) {
      const item = itemFromIndex(row.item_index);
      // A row written by a newer build that knew about an item this one does
      // not. Skipping it is better than refusing to let the player in.
      if (item === null) continue;
      items.push({ item, count: row.count });
    }
    return items;
  }

  private loadTrees(): PersistedTree[] {
    return this.ctx.storage.sql
      .exec<{
        tree_id: number;
        swings_taken: number;
        felled: number;
        felled_at_ms: number;
        generation: number;
      }>('SELECT tree_id, swings_taken, felled, felled_at_ms, generation FROM trees')
      .toArray()
      .map((row) => ({
        treeId: row.tree_id,
        swingsTaken: row.swings_taken,
        felled: row.felled !== 0,
        felledAtMs: row.felled_at_ms,
        generation: row.generation,
      }));
  }

  private writeTree(tree: PersistedTree): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO trees (tree_id, swings_taken, felled, felled_at_ms, generation, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(tree_id) DO UPDATE SET ' +
        'swings_taken = excluded.swings_taken, felled = excluded.felled, ' +
        'felled_at_ms = excluded.felled_at_ms, generation = excluded.generation, ' +
        'updated_at = excluded.updated_at',
      tree.treeId,
      tree.swingsTaken,
      tree.felled ? 1 : 0,
      tree.felledAtMs,
      tree.generation,
      Date.now(),
    );
  }

  private loadBuiltProps(): (BuiltProp & { readonly ownerKey: string | null })[] {
    const props: (BuiltProp & { readonly ownerKey: string | null })[] = [];
    const rows = this.ctx.storage.sql
      .exec<{
        id: number;
        kind_index: number;
        x: number;
        z: number;
        owner_key: string | null;
      }>('SELECT id, kind_index, x, z, owner_key FROM built_props')
      .toArray();
    for (const row of rows) {
      const kind = buildableKindFromIndex(row.kind_index);
      // A row written by a newer build that knew about a kind this one does
      // not. Skipping it is better than refusing to let anybody in.
      if (kind === null) continue;
      props.push({ id: row.id, kind, x: row.x, z: row.z, ownerKey: row.owner_key });
    }
    return props;
  }

  /** Built props are never updated once placed, so this is always a fresh insert. */
  private writeBuiltProp(prop: BuiltProp, ownerKey: string | null): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO built_props (id, kind_index, x, z, built_at_ms, owner_key) VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(id) DO NOTHING',
      prop.id,
      buildableKindIndex(prop.kind),
      prop.x,
      prop.z,
      Date.now(),
      ownerKey,
    );
  }

  private loadTakenPickups(): number[] {
    return this.ctx.storage.sql
      .exec<{ pickup_id: number }>('SELECT pickup_id FROM pickups_taken')
      .toArray()
      .map((row) => row.pickup_id);
  }

  /** Write one player's position, used when they disconnect. */
  private savePlayer(simulation: WorldSimulation, attachment: ConnectionAttachment): void {
    if (attachment.playerKey === null) return;
    const motion = simulation.readPlayer(attachment.netId);
    if (motion === undefined) return;
    this.writePlayer(
      attachment.playerKey,
      motion.position.x,
      motion.position.y,
      motion.position.z,
      motion.facingYaw,
      simulation.hungerOf(attachment.netId),
      simulation.healthOf(attachment.netId),
    );
    this.writePlayerItems(
      attachment.playerKey,
      inventoryEntries(simulation.inventoryOf(attachment.netId)),
    );
  }

  private writePlayer(
    playerKey: string,
    x: number,
    y: number,
    z: number,
    facingYaw: number,
    hunger: number,
    health: number,
  ): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO players (player_key, x, y, z, facing_yaw, hunger, health, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(player_key) DO UPDATE SET ' +
        'x = excluded.x, y = excluded.y, z = excluded.z, facing_yaw = excluded.facing_yaw, ' +
        'hunger = excluded.hunger, health = excluded.health, updated_at = excluded.updated_at',
      playerKey,
      x,
      y,
      z,
      facingYaw,
      hunger,
      health,
      Date.now(),
    );
  }

  private writePlayerItems(
    playerKey: string,
    items: readonly { readonly item: ItemId; readonly count: number }[],
  ): void {
    const sql = this.ctx.storage.sql;
    // Replace the lot rather than reconcile: a pack is a handful of rows, and
    // this cannot leave a stale row behind for something no longer carried.
    sql.exec('DELETE FROM player_items WHERE player_key = ?', playerKey);
    for (const entry of items) {
      sql.exec(
        'INSERT INTO player_items (player_key, item_index, count) VALUES (?, ?, ?)',
        playerKey,
        itemIndex(entry.item),
        entry.count,
      );
    }
  }

  private writeTakenPickup(pickupId: number, netId: number): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO pickups_taken (pickup_id, net_id, taken_at) VALUES (?, ?, ?) ' +
        'ON CONFLICT(pickup_id) DO NOTHING',
      pickupId,
      netId,
      Date.now(),
    );
  }

  /** Write everything worth keeping: the tick count and where everyone is. */
  private save(simulation: WorldSimulation): void {
    this.writeMeta('tick', String(simulation.tick));
    for (const tree of simulation.persistableTrees()) this.writeTree(tree);

    const byNetId = new Map<number, ConnectionAttachment>();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment?.playerKey != null) byNetId.set(attachment.netId, attachment);
    }

    for (const player of simulation.persistablePlayers()) {
      const attachment = byNetId.get(player.netId);
      if (attachment?.playerKey == null) continue;
      this.writePlayer(
        attachment.playerKey,
        player.x,
        player.y,
        player.z,
        player.facingYaw,
        player.hunger,
        // Optional on PersistedPlayer only so an old save without it still
        // loads - persistablePlayers() itself always sets it.
        player.health ?? HEALTH_MAX,
      );
      this.writePlayerItems(attachment.playerKey, player.items);
    }
  }

  /** A small summary, useful from a browser while playtesting. */
  status(): {
    players: number;
    tick: number;
    seed: number;
    running: boolean;
    slowTicks: number;
  } {
    const simulation = this.simulation;
    return {
      players: simulation?.playerCount ?? 0,
      tick: simulation?.tick ?? this.loadTick(),
      seed: simulation?.seed ?? this.seed(),
      running: this.tickHandle !== null,
      slowTicks: this.slowTickCount,
    };
  }
}
