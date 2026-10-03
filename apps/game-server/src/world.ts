import { DurableObject } from 'cloudflare:workers';

import {
  CHARACTER_KINDS,
  CLOSE_PLAYING_ELSEWHERE,
  DEFAULT_CHARACTER,
  DEFAULT_TINT_COLOR,
  DEFAULT_WORLD_SEED,
  HEALTH_MAX,
  HUNGER_MAX,
  MAX_GESTURES_PER_MESSAGE,
  MAX_PLAYERS_PER_WORLD,
  SAVE_INTERVAL_TICKS,
  SLOW_TICK_BUDGET_MS,
  SNAPSHOT_EVERY_N_TICKS,
  EXPLORED_SEND_INTERVAL_TICKS,
  TICK_MILLISECONDS,
  RejectReason,
  WorldSimulation,
  buildableKindFromIndex,
  buildableKindIndex,
  characterFromIndex,
  characterIndex,
  decodeClientMessage,
  encodeInventory,
  encodePickupsTaken,
  encodePlayerLeft,
  encodePong,
  encodeBuiltProps,
  encodeBuriedCaches,
  encodeCache,
  encodeCaught,
  encodeCrafted,
  encodeCooked,
  encodeDiscarded,
  encodePickupRefused,
  encodeCollected,
  MAX_COLLECTIONS_PER_MESSAGE,
  encodeDroppedPiles,
  encodeFishing,
  encodeGatherPatches,
  encodeHealth,
  encodeHunger,
  encodeRaidNews,
  encodeRaiderHit,
  encodeRaiders,
  encodeRejected,
  encodeEquipped,
  encodeExplored,
  encodeGestures,
  encodeSpace,
  encodeRoster,
  encodeSnapshot,
  encodeThreatHit,
  encodeTreeHit,
  encodeTreeStates,
  encodeWelcome,
  inventoryEntries,
  isValidPlayerName,
  itemFromIndex,
  itemIndex,
  sanitizePlayerName,
  SPAWN_POSITION,
  tintColorFromIndex,
  tintColorIndex,
  type BuiltProp,
  type BuriedCache,
  type CharacterId,
  type ItemId,
  type PersistedPatch,
  type PersistedPile,
  type PersistedPlayer,
  type PersistedTree,
  type RosterEntry,
  type SnapshotEntity,
  type TintColorId,
} from '@acorn/shared';

import type { WorldEnv } from './env';

/** What we keep on a WebSocket so it survives the object going to sleep. */
interface ConnectionAttachment {
  readonly netId: number;
  /** Identifies the player between visits. Phase 1 replaces this with a real account. */
  readonly playerKey: string | null;
  /** Null until this connection's own `Hello` arrives. */
  readonly name: string | null;
  readonly characterIndex: number;
  readonly colorIndex: number;
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

    // Playtesting-only: wipes every saved player's pack, hunger, health and
    // name, and lets the axe, bag and rod be found again. The confirm value
    // is not real access control - a plain query string is not that - only a
    // guard against firing from a stray link click or crawler prefetch.
    if (url.pathname.endsWith('/reset-players')) {
      if (url.searchParams.get('confirm') !== 'clear-everyone') {
        return Response.json(
          { ok: false, reason: 'Missing ?confirm=clear-everyone' },
          { status: 400 },
        );
      }
      return Response.json(this.resetPlayers());
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('This endpoint speaks WebSocket.', { status: 426 });
    }

    const simulation = this.ensureSimulation();
    const requestedKey = url.searchParams.get('player');
    const playerKey =
      requestedKey !== null && PLAYER_KEY_PATTERN.test(requestedKey) ? requestedKey : null;

    // The same player already here on another connection - one that dropped
    // without this end hearing it close yet, or another tab - carries on in
    // the body they already have, right where it stands, rather than leaving
    // a copy of themselves behind (see decision 0057).
    const earlier = playerKey !== null ? this.connectionOf(playerKey, simulation) : null;

    if (earlier === null && simulation.playerCount >= MAX_PLAYERS_PER_WORLD) {
      const { 0: client, 1: server } = new WebSocketPair();
      server.accept();
      server.send(encodeRejected(RejectReason.WorldFull));
      server.close(4001, 'This world is full');
      return new Response(null, { status: 101, webSocket: client });
    }

    const netId = earlier?.attachment.netId ?? this.claimNetId();
    const { 0: client, 1: server } = new WebSocketPair();

    // A returning player's own name and tint, so they need not wait for a
    // fresh Hello to be counted among "who else is here" by the next player
    // to join right behind them.
    const identity =
      earlier?.attachment ?? (playerKey ? this.loadPlayerIdentity(playerKey) : undefined);

    if (earlier !== null) {
      this.letGo(earlier.ws, CLOSE_PLAYING_ELSEWHERE, 'Playing somewhere else now');
    }

    // Hibernatable sockets: the runtime can put this object to sleep and wake it
    // when a message arrives, instead of us holding it open.
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      netId,
      playerKey,
      name: identity?.name ?? null,
      characterIndex: identity?.characterIndex ?? characterIndex(DEFAULT_CHARACTER),
      colorIndex: identity?.colorIndex ?? tintColorIndex(DEFAULT_TINT_COLOR),
    } satisfies ConnectionAttachment);

    if (earlier !== null) simulation.handOver(netId);
    else simulation.addPlayer(netId, playerKey ? this.loadPlayer(playerKey) : undefined, playerKey);
    server.send(encodeWelcome(netId, simulation.seed, simulation.tick, this.worldTimeMs()));
    // What you are carrying, and what is no longer lying about to be found.
    server.send(encodeInventory(inventoryEntries(simulation.inventoryOf(netId))));
    server.send(encodePickupsTaken(simulation.takenPickupIds()));
    server.send(encodeTreeStates(simulation.changedTrees()));
    server.send(this.builtPropsFor(simulation, playerKey));
    server.send(encodeBuriedCaches(simulation.buriedCachesList()));
    // Where every stick and flower patch is now, and what anybody dropped.
    server.send(encodeGatherPatches(simulation.gatherPatchesList()));
    server.send(encodeDroppedPiles(simulation.droppedPilesList()));
    // Any skeletons already out there, so they show up with the right look.
    server.send(encodeRaiders(simulation.raidersList()));
    server.send(encodeHunger({ netId, hunger: simulation.hungerOf(netId), ate: null }));
    server.send(
      encodeHealth({ netId, health: simulation.healthOf(netId), knockedOut: false, dodged: false }),
    );
    // Who else is already here. This player's own Hello, sent right after
    // Welcome, is what tells everybody else about them in turn.
    server.send(encodeRoster(this.currentRoster()));
    server.send(encodeEquipped(simulation.equippedList()));
    // Their map as they left it, before the first step has a chance to add
    // anything to it - see decision 0054.
    const explored = simulation.exploredMapOf(netId);
    if (explored !== null) server.send(encodeExplored(explored));
    // Outdoors, or waking up inside their own home - see decision 0055.
    const arrived = simulation.readPlayer(netId);
    if (arrived !== undefined) {
      server.send(
        encodeSpace(
          simulation.spaceOf(netId),
          arrived.position.x,
          arrived.position.z,
          arrived.facingYaw,
        ),
      );
    }
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
      // Unlike crafting this still depends on where the player is - the spot
      // has to be in reach - so it waits for the next tick rather than
      // settling immediately; the tick loop already has that to hand.
      simulation.requestBuild(attachment.netId, {
        kind: decoded.kind,
        x: decoded.x,
        z: decoded.z,
        yaw: decoded.yaw,
      });
      return;
    }
    if (decoded.type === 'useItem') {
      // Not aimed at anything, the same as crafting: settled the moment it
      // arrives rather than waiting for the next tick.
      simulation.useItem(attachment.netId, decoded.item);
      this.announceHunger(simulation);
      this.announceEquipped(simulation);
      return;
    }
    if (decoded.type === 'discard') {
      // Settled the moment it arrives, the same as crafting: dropping lands
      // wherever the player is standing right now.
      simulation.discardItem(
        attachment.netId,
        { item: decoded.item, amount: decoded.amount, destroy: decoded.destroy },
        Date.now(),
      );
      this.announceDiscards(simulation);
      this.announcePiles(simulation, Date.now());
      this.announceEquipped(simulation);
      this.announceFishing(simulation);
      return;
    }
    if (decoded.type === 'setDoorLock') {
      // Only ever their own door, settled the moment it arrives.
      const home = simulation.setHomeLocked(attachment.netId, decoded.locked);
      if (home !== null) {
        this.writeHomeLocked(home.id, home.locked === true);
        this.broadcastBuiltProps(simulation);
      }
      return;
    }
    if (decoded.type === 'hello') {
      this.handleHello(ws, attachment, decoded.name, decoded.character, decoded.color);
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
    this.announceCollections(simulation);
    this.announcePickupRefusals(simulation);
    this.announceChopping(simulation);
    this.announceCatching(simulation);
    this.announceThreatHits(simulation);
    this.announceRaids(simulation);
    this.announceBuilding(simulation);
    this.announceFishing(simulation);
    this.announceHunger(simulation);
    this.announceCooking(simulation);
    this.announceEquipped(simulation);
    this.announceHealth(simulation);
    this.announceBuriedCaches(simulation);
    this.announceRegrowth(simulation, startedAt);
    this.announcePatches(simulation, startedAt);
    this.announcePiles(simulation, startedAt);
    this.announceCampfireLighting(simulation, startedAt);
    this.announceSpaceChanges(simulation);
    this.announceGestures(simulation);
    if (simulation.tick % EXPLORED_SEND_INTERVAL_TICKS === 0) this.announceExplored(simulation);

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

  private announceCollections(simulation: WorldSimulation): void {
    const events = simulation.drainCollectionEvents();
    for (let start = 0; start < events.length; start += MAX_COLLECTIONS_PER_MESSAGE) {
      this.broadcast(encodeCollected(events.slice(start, start + MAX_COLLECTIONS_PER_MESSAGE)));
    }
  }

  /** Capacity feedback belongs only to the player who tried to pick something up. */
  private announcePickupRefusals(simulation: WorldSimulation): void {
    const events = simulation.drainPickupRefusals();
    if (events.length === 0) return;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      for (const event of events) {
        if (event.netId === attachment?.netId)
          this.trySend(ws, encodePickupRefused(event.item, event.reason));
      }
    }
  }

  /**
   * Tell anybody who gathered from a patch or picked up a dropped pile this
   * tick what is in their pack now. What that did to the patch or the pile
   * is everybody's news, told by `announcePatches` and `announcePiles`.
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

    let anythingFell = false;
    for (const event of events) {
      this.broadcast(encodeTreeHit(event.treeId, event.swingsLeft, event.netId));
      if (event.swingsLeft === 0) anythingFell = true;
    }

    if (anythingFell) {
      // Sending the whole list is cheap while a clearing has a hundred and
      // forty trees; a bigger world would want to send only what changed.
      this.broadcast(encodeTreeStates(simulation.changedTrees()));
    }

    // Only the trees that are down or part cut, which is a short list.
    for (const tree of simulation.persistableTrees()) this.writeTree(tree);
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
   * Tell everybody about skeleton raids (see decision 0063): the whole list
   * of raiders whenever one turns up, is hit or is gone, every blow that
   * landed on one, and every raid that turned up or ended. All of it goes to
   * everybody, the same as a threat hit: a raid on somebody else nearby is
   * worth knowing about too. None of it is saved - a raid only lasts while
   * somebody is here to fight it.
   */
  private announceRaids(simulation: WorldSimulation): void {
    if (simulation.drainRaidersChanged()) {
      this.broadcast(encodeRaiders(simulation.raidersList()));
    }
    for (const hit of simulation.drainRaiderHits()) this.broadcast(encodeRaiderHit(hit));
    for (const news of simulation.drainRaidNews()) this.broadcast(encodeRaidNews(news));
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
    this.broadcastBuiltProps(simulation);
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
   * Tell whoever just went through a door where they are now (see decision
   * 0055). Private to them: everybody else simply stops or starts seeing
   * them in their own snapshots.
   */
  private announceSpaceChanges(simulation: WorldSimulation): void {
    const changes = simulation.drainSpaceChanges();
    if (changes.length === 0) return;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      for (const change of changes) {
        if (change.netId !== attachment.netId) continue;
        this.trySend(ws, encodeSpace(change.space, change.x, change.z, change.yaw));
      }
    }
  }

  /**
   * Tell each player their map has grown, whole (see decision 0054).
   *
   * Private to the one it belongs to, and only as often as
   * `EXPLORED_SEND_INTERVAL_TICKS` allows: their own browser has already
   * filled the map in from where it thinks they are, so this only keeps it
   * honest, and keeps the copy that gets saved in step with what they saw.
   */
  private announceExplored(simulation: WorldSimulation): void {
    const changes = simulation.drainExploredChanges();
    if (changes.length === 0) return;

    const byNetId = new Map(changes.map((change) => [change.netId, change.explored]));
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const explored = byNetId.get(attachment.netId);
      if (explored !== undefined) this.trySend(ws, encodeExplored(explored));
    }
  }

  /**
   * Write a fresh burial or a dig-up to storage, tell whoever it happened to
   * for a HUD toast, and tell everybody the mound itself just appeared or
   * disappeared.
   *
   * A dig-up also changes the digger's own pack, the same as a build changes
   * the builder's - `sendPacks` handles that the same way.
   */
  private announceBuriedCaches(simulation: WorldSimulation): void {
    const changes = simulation.drainCacheEvents();
    if (changes.length === 0) return;

    for (const change of changes) {
      if (change.kind === 'buried') this.writeBuriedCache(change.cache);
      else this.deleteBuriedCache(change.cacheId);
    }

    const byNetId = new Map(
      changes.map((change) => [change.netId, { netId: change.netId, kind: change.kind }]),
    );
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const event = byNetId.get(attachment.netId);
      if (event !== undefined) this.trySend(ws, encodeCache(event));
    }
    this.sendPacks(simulation, new Set(byNetId.keys()));

    this.broadcast(encodeBuriedCaches(simulation.buriedCachesList()));
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

  /** Tell only the cook what one raw item became, then persist their changed pack. */
  private announceCooking(simulation: WorldSimulation): void {
    const events = simulation.drainCookingEvents();
    if (events.length === 0) return;

    const byNetId = new Map(events.map((event) => [event.netId, event]));
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const event = byNetId.get(attachment.netId);
      if (event !== undefined) this.trySend(ws, encodeCooked(event));
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

  /**
   * Bring back any picked-clean patch whose time is up, then tell everybody
   * about every patch that changed - gathered from, grown back or moved -
   * and write those straight to storage, so a patch picked clean stays
   * picked clean however soon the world goes to sleep (see decision 0061).
   *
   * Checked every tick for the same reason `announceRegrowth` is; the walk
   * is over a handful of patches.
   */
  private announcePatches(simulation: WorldSimulation, nowMs: number): void {
    simulation.regrowPatches(nowMs);
    const changed = simulation.drainPatchChanges();
    if (changed.length === 0) return;

    for (const id of changed) {
      const patch = simulation.persistedPatch(id);
      if (patch !== null) this.writePatch(patch);
    }
    this.broadcast(encodeGatherPatches(simulation.gatherPatchesList()));
  }

  /**
   * Let any dropped pile whose time is up fade, then tell everybody about
   * every pile that changed - dropped, added to, picked up or faded - and
   * write those straight to storage.
   */
  private announcePiles(simulation: WorldSimulation, nowMs: number): void {
    simulation.fadeDroppedPiles(nowMs);
    const changed = simulation.drainPileChanges();
    if (changed.length === 0) return;

    for (const id of changed) {
      const pile = simulation.persistedPile(id);
      if (pile === null) this.deletePile(id);
      else this.writePile(pile);
    }
    this.broadcast(encodeDroppedPiles(simulation.droppedPilesList()));
  }

  /**
   * Tell a player what they just dropped or destroyed, for their HUD, then
   * send their pack the same as any other way it changes. Private to them:
   * a dropped pile turning up is everybody's news, told by `announcePiles`.
   */
  private announceDiscards(simulation: WorldSimulation): void {
    const events = simulation.drainDiscardEvents();
    if (events.length === 0) return;

    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      for (const event of events) {
        if (event.netId === attachment.netId) this.trySend(ws, encodeDiscarded(event));
      }
    }
    this.sendPacks(simulation, new Set(events.map((event) => event.netId)));
  }

  /**
   * Tell everybody about a campfire lighting up or going out, whether a
   * player did it or it just burned down - checked every tick for the same
   * reason `announceRegrowth` is: the important run is the first one after a
   * world wakes, when anything that should already have gone out does.
   */
  private announceCampfireLighting(simulation: WorldSimulation, nowMs: number): void {
    const events = simulation.extinguishBurnedOutCampfires(nowMs);
    if (events.length === 0) return;

    this.broadcastBuiltProps(simulation);
    for (const event of events) {
      this.writeCampfireLitState(event.propId, simulation.campfireLitUntilMsFor(event.propId));
    }
  }

  /**
   * Tell everybody what anybody did with their hands this tick - picked
   * something up, dug, reached out, ate - so every browser can play it on
   * them (see decision 0056). One small message for the lot.
   */
  private announceGestures(simulation: WorldSimulation): void {
    const gestures = simulation.drainGestureEvents();
    for (let start = 0; start < gestures.length; start += MAX_GESTURES_PER_MESSAGE) {
      this.broadcast(encodeGestures(gestures.slice(start, start + MAX_GESTURES_PER_MESSAGE)));
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
          simulation.actionOf(attachment.netId)?.dodgeCooldown ?? 0,
        ),
      );
    }
  }

  /**
   * A player introduced themselves: sanitise what they said, refuse a
   * character that is not available yet regardless of what the client
   * asked for, remember it for next time, and let everybody know.
   */
  private handleHello(
    ws: WebSocket,
    attachment: ConnectionAttachment,
    rawName: string,
    requestedCharacter: CharacterId,
    color: TintColorId,
  ): void {
    const name = sanitizePlayerName(rawName);
    if (!isValidPlayerName(name)) return;

    const character = CHARACTER_KINDS[requestedCharacter].available
      ? requestedCharacter
      : DEFAULT_CHARACTER;

    const updated: ConnectionAttachment = {
      ...attachment,
      name,
      characterIndex: characterIndex(character),
      colorIndex: tintColorIndex(color),
    };
    ws.serializeAttachment(updated);

    if (attachment.playerKey !== null) {
      this.writePlayerIdentity(
        attachment.playerKey,
        name,
        updated.characterIndex,
        updated.colorIndex,
      );
    }
    this.broadcast(encodeRoster(this.currentRoster()));
  }

  /** Who everybody currently connected says they are, straight from each socket's own attachment. */
  private currentRoster(): RosterEntry[] {
    const entries: RosterEntry[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null || attachment.name === null) continue;
      entries.push({
        netId: attachment.netId,
        name: attachment.name,
        character: characterFromIndex(attachment.characterIndex) ?? DEFAULT_CHARACTER,
        color: tintColorFromIndex(attachment.colorIndex) ?? DEFAULT_TINT_COLOR,
      });
    }
    return entries;
  }

  /**
   * Tell everybody what everybody currently has equipped, whole - the same
   * "sent whole, on change" shape `Roster` already uses. Everybody's
   * business, unlike hunger or health: what's in your hand is exactly as
   * public as your own name tag.
   */
  private announceEquipped(simulation: WorldSimulation): void {
    if (simulation.drainEquipEvents().length === 0) return;
    this.broadcast(encodeEquipped(simulation.equippedList()));
  }

  /**
   * Everything built, to everybody - each with their own copy, since whether
   * a piece is theirs travels with it (see `BuiltPropView`).
   */
  private broadcastBuiltProps(simulation: WorldSimulation): void {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      this.trySend(ws, this.builtPropsFor(simulation, attachment.playerKey));
    }
  }

  /** The built-prop list as this player should hear it, their own pieces marked. */
  private builtPropsFor(simulation: WorldSimulation, playerKey: string | null): ArrayBuffer {
    return encodeBuiltProps(
      simulation.builtPropsList(),
      (propId) => playerKey !== null && simulation.builtPropOwner(propId) === playerKey,
    );
  }

  private broadcast(payload: ArrayBuffer, except?: WebSocket): void {
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except || this.attachmentFor(ws) === null) continue;
      this.trySend(ws, payload);
    }
  }

  /** The live connection playing as `playerKey`, if they are here already. */
  private connectionOf(
    playerKey: string,
    simulation: WorldSimulation,
  ): { ws: WebSocket; attachment: ConnectionAttachment } | null {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment?.playerKey === playerKey && simulation.hasPlayer(attachment.netId)) {
        return { ws, attachment };
      }
    }
    return null;
  }

  /**
   * Hang up on a connection whose player has moved on to another one. Its
   * attachment goes first, so nothing counts it as anybody from here on -
   * not the snapshots, not the roster, and not its own close arriving later,
   * which would otherwise take the player out from under the new connection.
   */
  private letGo(ws: WebSocket, code: number, reason: string): void {
    ws.serializeAttachment(null);
    try {
      ws.close(code, reason);
    } catch {
      // Already gone at the far end, which is usually why they came back.
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
      patchRegrowMinSeconds: this.patchRegrowMinSeconds(),
      hungerEmptyAfterSeconds: this.hungerEmptyAfterSeconds(),
      raidIntervalSeconds: this.raidIntervalSeconds(),
    });
    this.simulation = simulation;
    simulation.restoreTakenPickups(this.loadTakenPickups());
    simulation.restoreTrees(this.loadTrees());
    simulation.restoreBuiltProps(this.loadBuiltProps());
    simulation.restoreBuriedCaches(this.loadBuriedCaches());
    simulation.restorePatches(this.loadPatches());
    simulation.restoreDroppedPiles(this.loadPiles(), Date.now());

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
    this.announcePatches(simulation, Date.now());
    this.announcePiles(simulation, Date.now());
    this.announceCampfireLighting(simulation, Date.now());
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
   * How long a picked-clean stick or flower patch takes to grow back, if the
   * environment says. Only honoured when it is a sensible positive number,
   * the same as `regrowMinSeconds`.
   */
  private patchRegrowMinSeconds(): number | undefined {
    const configured = Number(this.env.WORLD_PATCH_REGROW_SECONDS);
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

  /**
   * The shortest time outdoors between skeleton raids, if the environment
   * says. Only honoured when it is a sensible positive number, so a typo in a
   * dashboard variable cannot send raids every tick.
   */
  private raidIntervalSeconds(): number | undefined {
    const configured = Number(this.env.WORLD_RAID_SECONDS);
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
    this.addColumn('trees', 'fall_yaw', 'REAL');
    // A player saved before this release has no hunger on record. The default
    // above starts them full, same as anybody arriving fresh.
    this.addColumn('players', 'hunger', 'REAL NOT NULL DEFAULT 100');
    // Likewise health, added when knockout shipped: nobody was ever hurt
    // before that, so full is the only sensible default here too.
    this.addColumn('players', 'health', 'REAL NOT NULL DEFAULT 100');
    // Null until a player's first Hello. Nobody had a name before the Home
    // screen existed, so leaving it unset is exactly right for them too.
    this.addColumn('players', 'name', 'TEXT');
    this.addColumn('players', 'character_index', 'INTEGER NOT NULL DEFAULT 0');
    this.addColumn('players', 'color_index', 'INTEGER NOT NULL DEFAULT 0');
    // Null for a player saved before this existed, or one who never chose
    // anything - `initialEquippedItem` treats that exactly like a brand new
    // player, falling back to the first tool they still have, if any.
    this.addColumn('players', 'equipped_item_index', 'INTEGER');
    // Null for anybody saved before the map existed: they start a fresh one,
    // the same blank page a brand new player gets.
    this.addColumn('players', 'explored', 'BLOB');
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
    // Only a campfire ever sets this: when it should go out on its own. Null
    // means unlit - true of everything built before this existed, which is
    // exactly right, and of every non-campfire kind, forever.
    this.addColumn('built_props', 'lit_until_ms', 'INTEGER');
    // Which way a piece was turned when placed. Null for everything built
    // before pieces could be turned, which all faced the same way - zero.
    this.addColumn('built_props', 'yaw', 'REAL');
    // Every door was open before doors could be locked.
    this.addColumn('built_props', 'locked', 'INTEGER NOT NULL DEFAULT 0');
    // What a knockout buries, until it is dug back up - unlike built props,
    // this one is deleted once its reason for existing is gone.
    sql.exec(`CREATE TABLE IF NOT EXISTS buried_caches (
      id INTEGER PRIMARY KEY,
      owner_key TEXT,
      x REAL NOT NULL,
      z REAL NOT NULL,
      buried_at_ms INTEGER NOT NULL
    )`);
    sql.exec(`CREATE TABLE IF NOT EXISTS buried_cache_items (
      cache_id INTEGER NOT NULL,
      item_index INTEGER NOT NULL,
      count INTEGER NOT NULL,
      PRIMARY KEY (cache_id, item_index)
    )`);
    // Where each stick and flower patch is now and how many it has left (see
    // decision 0061). A patch with no row is still where the clearing first
    // laid it, holding its first count.
    sql.exec(`CREATE TABLE IF NOT EXISTS gather_patches (
      patch_id INTEGER PRIMARY KEY,
      x REAL NOT NULL,
      z REAL NOT NULL,
      remaining INTEGER NOT NULL,
      generation INTEGER NOT NULL,
      emptied_at_ms INTEGER NOT NULL
    )`);
    // Whatever anybody dropped, until it is picked up or fades.
    sql.exec(`CREATE TABLE IF NOT EXISTS dropped_piles (
      id INTEGER PRIMARY KEY,
      item_index INTEGER NOT NULL,
      count INTEGER NOT NULL,
      x REAL NOT NULL,
      z REAL NOT NULL,
      dropped_at_ms INTEGER NOT NULL
    )`);
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
        equipped_item_index: number | null;
        explored: ArrayBuffer | null;
      }>(
        'SELECT x, y, z, facing_yaw, hunger, health, equipped_item_index, explored ' +
          'FROM players WHERE player_key = ?',
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
      equippedItem:
        row.equipped_item_index === null ? null : itemFromIndex(row.equipped_item_index),
      explored: row.explored === null ? null : new Uint8Array(row.explored),
    };
  }

  /** A returning player's last-known name and tint, if they ever sent a Hello. */
  private loadPlayerIdentity(
    playerKey: string,
  ): { name: string; characterIndex: number; colorIndex: number } | undefined {
    const rows = this.ctx.storage.sql
      .exec<{
        name: string | null;
        character_index: number;
        color_index: number;
      }>('SELECT name, character_index, color_index FROM players WHERE player_key = ?', playerKey)
      .toArray();
    const row = rows[0];
    if (row === undefined || row.name === null) return undefined;
    return { name: row.name, characterIndex: row.character_index, colorIndex: row.color_index };
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
        fall_yaw: number | null;
      }>('SELECT tree_id, swings_taken, felled, felled_at_ms, generation, fall_yaw FROM trees')
      .toArray()
      .map((row) => ({
        treeId: row.tree_id,
        swingsTaken: row.swings_taken,
        felled: row.felled !== 0,
        felledAtMs: row.felled_at_ms,
        generation: row.generation,
        fallYaw: row.fall_yaw,
      }));
  }

  private writeTree(tree: PersistedTree): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO trees (tree_id, swings_taken, felled, felled_at_ms, generation, fall_yaw, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(tree_id) DO UPDATE SET ' +
        'swings_taken = excluded.swings_taken, felled = excluded.felled, ' +
        'felled_at_ms = excluded.felled_at_ms, generation = excluded.generation, ' +
        'fall_yaw = excluded.fall_yaw, updated_at = excluded.updated_at',
      tree.treeId,
      tree.swingsTaken,
      tree.felled ? 1 : 0,
      tree.felledAtMs,
      tree.generation,
      tree.fallYaw ?? null,
      Date.now(),
    );
  }

  private loadBuiltProps(): (BuiltProp & {
    readonly ownerKey: string | null;
    readonly litUntilMs: number | null;
  })[] {
    const props: (BuiltProp & {
      readonly ownerKey: string | null;
      readonly litUntilMs: number | null;
    })[] = [];
    const rows = this.ctx.storage.sql
      .exec<{
        id: number;
        kind_index: number;
        x: number;
        z: number;
        owner_key: string | null;
        lit_until_ms: number | null;
        yaw: number | null;
        locked: number;
      }>('SELECT id, kind_index, x, z, owner_key, lit_until_ms, yaw, locked FROM built_props')
      .toArray();
    for (const row of rows) {
      const kind = buildableKindFromIndex(row.kind_index);
      // A row written by a newer build that knew about a kind this one does
      // not. Skipping it is better than refusing to let anybody in.
      if (kind === null) continue;
      props.push({
        id: row.id,
        kind,
        x: row.x,
        z: row.z,
        yaw: row.yaw ?? 0,
        // Restored as lit even if this moment has already passed - the same
        // way a felled tree is restored as felled regardless of whether it is
        // due back - and corrected within the first tick after waking by
        // `extinguishBurnedOutCampfires`.
        lit: row.lit_until_ms !== null,
        locked: row.locked !== 0,
        ownerKey: row.owner_key,
        litUntilMs: row.lit_until_ms,
      });
    }
    return props;
  }

  /**
   * A built prop's identity (kind, x, z, yaw) is never updated once placed,
   * so this is always a fresh insert - whether a campfire is currently lit
   * is a separate, mutable fact, updated afterwards by
   * `writeCampfireLitState`.
   */
  private writeBuiltProp(prop: BuiltProp, ownerKey: string | null): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO built_props (id, kind_index, x, z, yaw, built_at_ms, owner_key) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING',
      prop.id,
      buildableKindIndex(prop.kind),
      prop.x,
      prop.z,
      prop.yaw,
      Date.now(),
      ownerKey,
    );
  }

  private writeHomeLocked(propId: number, locked: boolean): void {
    this.ctx.storage.sql.exec(
      'UPDATE built_props SET locked = ? WHERE id = ?',
      locked ? 1 : 0,
      propId,
    );
  }

  private writeCampfireLitState(propId: number, litUntilMs: number | null): void {
    this.ctx.storage.sql.exec(
      'UPDATE built_props SET lit_until_ms = ? WHERE id = ?',
      litUntilMs,
      propId,
    );
  }

  private loadBuriedCaches(): BuriedCache[] {
    const rows = this.ctx.storage.sql
      .exec<{
        id: number;
        owner_key: string | null;
        x: number;
        z: number;
      }>('SELECT id, owner_key, x, z FROM buried_caches')
      .toArray();
    return rows.map((row) => ({
      id: row.id,
      ownerPlayerKey: row.owner_key,
      x: row.x,
      z: row.z,
      items: this.loadBuriedCacheItems(row.id),
    }));
  }

  private loadBuriedCacheItems(cacheId: number): { item: ItemId; count: number }[] {
    const rows = this.ctx.storage.sql
      .exec<{ item_index: number; count: number }>(
        'SELECT item_index, count FROM buried_cache_items WHERE cache_id = ?',
        cacheId,
      )
      .toArray();
    const items: { item: ItemId; count: number }[] = [];
    for (const row of rows) {
      const item = itemFromIndex(row.item_index);
      // A row written by a newer build that knew about an item this one does
      // not. Skipping it is better than refusing to let anybody in.
      if (item === null) continue;
      items.push({ item, count: row.count });
    }
    return items;
  }

  private writeBuriedCache(cache: BuriedCache): void {
    const sql = this.ctx.storage.sql;
    sql.exec(
      'INSERT INTO buried_caches (id, owner_key, x, z, buried_at_ms) VALUES (?, ?, ?, ?, ?) ' +
        'ON CONFLICT(id) DO NOTHING',
      cache.id,
      cache.ownerPlayerKey,
      cache.x,
      cache.z,
      Date.now(),
    );
    for (const entry of cache.items) {
      sql.exec(
        'INSERT INTO buried_cache_items (cache_id, item_index, count) VALUES (?, ?, ?)',
        cache.id,
        itemIndex(entry.item),
        entry.count,
      );
    }
  }

  /** Dug up, or otherwise gone: nothing keeps a cache around once it no longer exists. */
  private deleteBuriedCache(cacheId: number): void {
    const sql = this.ctx.storage.sql;
    sql.exec('DELETE FROM buried_caches WHERE id = ?', cacheId);
    sql.exec('DELETE FROM buried_cache_items WHERE cache_id = ?', cacheId);
  }

  private loadPatches(): PersistedPatch[] {
    return this.ctx.storage.sql
      .exec<{
        patch_id: number;
        x: number;
        z: number;
        remaining: number;
        generation: number;
        emptied_at_ms: number;
      }>('SELECT patch_id, x, z, remaining, generation, emptied_at_ms FROM gather_patches')
      .toArray()
      .map((row) => ({
        id: row.patch_id,
        x: row.x,
        z: row.z,
        remaining: row.remaining,
        generation: row.generation,
        emptiedAtMs: row.emptied_at_ms,
      }));
  }

  private writePatch(patch: PersistedPatch): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO gather_patches (patch_id, x, z, remaining, generation, emptied_at_ms) ' +
        'VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(patch_id) DO UPDATE SET x = excluded.x, z = excluded.z, ' +
        'remaining = excluded.remaining, generation = excluded.generation, ' +
        'emptied_at_ms = excluded.emptied_at_ms',
      patch.id,
      patch.x,
      patch.z,
      patch.remaining,
      patch.generation,
      patch.emptiedAtMs,
    );
  }

  private loadPiles(): PersistedPile[] {
    const rows = this.ctx.storage.sql
      .exec<{
        id: number;
        item_index: number;
        count: number;
        x: number;
        z: number;
        dropped_at_ms: number;
      }>('SELECT id, item_index, count, x, z, dropped_at_ms FROM dropped_piles')
      .toArray();
    const piles: PersistedPile[] = [];
    for (const row of rows) {
      const item = itemFromIndex(row.item_index);
      // Written by a newer build that knew an item this one does not.
      if (item === null) continue;
      piles.push({
        id: row.id,
        item,
        count: row.count,
        x: row.x,
        z: row.z,
        droppedAtMs: row.dropped_at_ms,
      });
    }
    return piles;
  }

  private writePile(pile: PersistedPile): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO dropped_piles (id, item_index, count, x, z, dropped_at_ms) ' +
        'VALUES (?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET item_index = excluded.item_index, ' +
        'count = excluded.count, x = excluded.x, z = excluded.z, ' +
        'dropped_at_ms = excluded.dropped_at_ms',
      pile.id,
      itemIndex(pile.item),
      pile.count,
      pile.x,
      pile.z,
      pile.droppedAtMs,
    );
  }

  /** Picked up or faded: nothing keeps a pile around once it no longer exists. */
  private deletePile(id: number): void {
    this.ctx.storage.sql.exec('DELETE FROM dropped_piles WHERE id = ?', id);
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
    // Somebody inside a home is kept at its front door: a room's own
    // coordinates mean nothing out in the world (see decision 0055).
    const outside = simulation.outdoorPositionOf(attachment.netId);
    if (outside === null) return;
    const equipped = simulation.equippedItemOf(attachment.netId);
    this.writePlayer(
      attachment.playerKey,
      outside.x,
      outside.y,
      outside.z,
      outside.yaw,
      simulation.hungerOf(attachment.netId),
      simulation.healthOf(attachment.netId),
      equipped === null ? null : itemIndex(equipped),
    );
    this.writePlayerItems(
      attachment.playerKey,
      inventoryEntries(simulation.inventoryOf(attachment.netId)),
    );
    const explored = simulation.exploredMapOf(attachment.netId);
    if (explored !== null) this.writePlayerExplored(attachment.playerKey, explored);
  }

  private writePlayer(
    playerKey: string,
    x: number,
    y: number,
    z: number,
    facingYaw: number,
    hunger: number,
    health: number,
    equippedItemIndex: number | null,
  ): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO players ' +
        '(player_key, x, y, z, facing_yaw, hunger, health, equipped_item_index, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(player_key) DO UPDATE SET ' +
        'x = excluded.x, y = excluded.y, z = excluded.z, facing_yaw = excluded.facing_yaw, ' +
        'hunger = excluded.hunger, health = excluded.health, ' +
        'equipped_item_index = excluded.equipped_item_index, updated_at = excluded.updated_at',
      playerKey,
      x,
      y,
      z,
      facingYaw,
      hunger,
      health,
      equippedItemIndex,
      Date.now(),
    );
  }

  /**
   * Remember a player's name, character and tint for next time.
   *
   * Separate from `writePlayer`: a Hello can arrive before this player's
   * position has ever been saved, for a brand new `player_key`, so a fresh
   * row here seeds sensible placeholders for the columns it does not touch
   * (the same spawn point and full meters a genuinely new player starts
   * with) rather than leaving them NULL. `ON CONFLICT` then updates only the
   * three identity columns, exactly as it does for `writePlayer`'s own
   * columns, so this never clobbers a real saved position.
   */
  private writePlayerIdentity(
    playerKey: string,
    name: string,
    characterIndex: number,
    colorIndex: number,
  ): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO players ' +
        '(player_key, x, y, z, facing_yaw, hunger, health, name, character_index, color_index, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(player_key) DO UPDATE SET ' +
        'name = excluded.name, character_index = excluded.character_index, ' +
        'color_index = excluded.color_index, updated_at = excluded.updated_at',
      playerKey,
      SPAWN_POSITION.x,
      SPAWN_POSITION.y,
      SPAWN_POSITION.z,
      0,
      HUNGER_MAX,
      HEALTH_MAX,
      name,
      characterIndex,
      colorIndex,
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

  /**
   * Keep one player's map. Only ever called once their row exists - after
   * `writePlayer` or `writePlayerIdentity` - so a plain update is enough.
   */
  private writePlayerExplored(playerKey: string, explored: Uint8Array): void {
    this.ctx.storage.sql.exec(
      'UPDATE players SET explored = ? WHERE player_key = ?',
      explored.slice().buffer,
      playerKey,
    );
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
        player.equippedItem == null ? null : itemIndex(player.equippedItem),
      );
      this.writePlayerItems(attachment.playerKey, player.items);
      if (player.explored != null) this.writePlayerExplored(attachment.playerKey, player.explored);
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

  /**
   * Wipe every saved player's pack, hunger, health, position and name back to
   * nothing, and let the axe, bag and rod be found again - a clean slate for
   * playtesting, not something a player ever triggers themselves. Refuses
   * outright while anyone is connected: their still-live session would just
   * write its own (unwiped) state back over this the moment they leave,
   * undoing it without saying so.
   *
   * Deliberately narrower than "reset the world": built props, felled/regrown
   * trees and buried caches are left exactly as they are, since none of those
   * are "inventory" and wiping them would erase testing history nobody asked
   * to lose.
   */
  resetPlayers(): { ok: true; clearedPlayers: number } | { ok: false; reason: string } {
    if (this.simulation !== null) {
      return {
        ok: false,
        reason: 'Somebody is still connected to this world - try again once everybody has left.',
      };
    }
    const sql = this.ctx.storage.sql;
    const clearedPlayers = sql
      .exec<{ player_key: string }>('SELECT player_key FROM players')
      .toArray().length;
    sql.exec('DELETE FROM player_items');
    sql.exec('DELETE FROM players');
    sql.exec('DELETE FROM pickups_taken');
    return { ok: true, clearedPlayers };
  }
}
