import { DurableObject } from 'cloudflare:workers';

import {
  DEFAULT_WORLD_SEED,
  MAX_PLAYERS_PER_WORLD,
  SAVE_INTERVAL_TICKS,
  SLOW_TICK_BUDGET_MS,
  SNAPSHOT_EVERY_N_TICKS,
  TICK_MILLISECONDS,
  RejectReason,
  WorldSimulation,
  decodeClientMessage,
  encodeInventory,
  encodePickupsTaken,
  encodePlayerLeft,
  encodePong,
  encodeRejected,
  encodeSnapshot,
  encodeWelcome,
  inventoryEntries,
  itemFromIndex,
  itemIndex,
  type ItemId,
  type PersistedPlayer,
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

    simulation.addPlayer(netId, playerKey ? this.loadPlayer(playerKey) : undefined);
    server.send(encodeWelcome(netId, simulation.seed, simulation.tick, this.worldTimeMs()));
    // What you are carrying, and what is no longer lying about to be found.
    server.send(encodeInventory(inventoryEntries(simulation.inventoryOf(netId))));
    server.send(encodePickupsTaken(simulation.takenPickupIds()));
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

    simulation.step();
    this.announcePickups(simulation);

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

    const simulation = new WorldSimulation({ seed: this.seed() });
    this.simulation = simulation;
    simulation.restoreTakenPickups(this.loadTakenPickups());

    let highestNetId = 0;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      simulation.addPlayer(
        attachment.netId,
        attachment.playerKey ? this.loadPlayer(attachment.playerKey) : undefined,
      );
      highestNetId = Math.max(highestNetId, attachment.netId);
    }
    this.nextNetId = highestNetId + 1;

    simulation.tick = this.loadTick();
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
      }>('SELECT x, y, z, facing_yaw FROM players WHERE player_key = ?', playerKey)
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
    );
    this.writePlayerItems(
      attachment.playerKey,
      inventoryEntries(simulation.inventoryOf(attachment.netId)),
    );
  }

  private writePlayer(playerKey: string, x: number, y: number, z: number, facingYaw: number): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO players (player_key, x, y, z, facing_yaw, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(player_key) DO UPDATE SET ' +
        'x = excluded.x, y = excluded.y, z = excluded.z, ' +
        'facing_yaw = excluded.facing_yaw, updated_at = excluded.updated_at',
      playerKey,
      x,
      y,
      z,
      facingYaw,
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

    const byNetId = new Map<number, ConnectionAttachment>();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment?.playerKey != null) byNetId.set(attachment.netId, attachment);
    }

    for (const player of simulation.persistablePlayers()) {
      const attachment = byNetId.get(player.netId);
      if (attachment?.playerKey == null) continue;
      this.writePlayer(attachment.playerKey, player.x, player.y, player.z, player.facingYaw);
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
