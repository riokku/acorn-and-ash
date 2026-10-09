import { encodeWildfire } from '@acorn/shared';
import { encodeRaiderVitals } from '@acorn/shared';
import {
  encodeDigRefused,
  encodeGearRefused,
  encodeWorn,
  gearSlotFromIndex,
  gearSlotIndex,
  wornEntries,
  GEAR_ITEMS,
  type GearSlot,
} from '@acorn/shared';
import {
  clockShiftForSeason,
  encodeDug,
  encodeLakeIce,
  SEASONS,
  type Dig,
  type SeasonId,
} from '@acorn/shared';
import {
  encodeFishRecords,
  encodeRareReel,
  fishRecordsFromSaved,
  type FishRecords,
} from '@acorn/shared';
import { encodeExpeditionState, expeditionFromSaved, type ExpeditionState } from '@acorn/shared';
import { encodeRecoveryMarkers } from '@acorn/shared';
import { encodeDecorationState, type HomeDecoration } from '@acorn/shared';
import { encodeMeal, mealFromSaved, type MealState } from '@acorn/shared';
import { isHomeKind } from '@acorn/shared';
import { encodeDiscoveries } from '@acorn/shared';
import { DurableObject } from 'cloudflare:workers';

import { encodeGardenState, TICK_HZ, type GardenState } from '@acorn/shared';
import {
  ABANDONED_BUILD_SECONDS,
  ABANDONED_OWNER,
  AXE_PICKUP_ID,
  BAG_PICKUP_ID,
  CHARACTER_KINDS,
  CLOSE_CHARACTER_DELETED,
  CLOSE_PLAYING_ELSEWHERE,
  DEFAULT_CHARACTER,
  DEFAULT_SKIN_TONE,
  DEFAULT_TINT_COLOR,
  DEFAULT_WORLD_SEED,
  HEALTH_MAX,
  HUNGER_MAX,
  MAX_GESTURES_PER_MESSAGE,
  MAX_PLAYERS_PER_WORLD,
  ROD_PICKUP_ID,
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
  encodeHomeSkills,
  encodeHomeSupplies,
  encodeHomeBuildFeedback,
  encodeChestState,
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
  skinToneFromIndex,
  skinToneIndex,
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
  type SkinToneId,
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
  /** Missing on a socket attached before skin tones existed: read as the default. */
  readonly skinIndex?: number;
}

/** A player key is supplied by the client, so it is checked before it is trusted. */
const PLAYER_KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * Every table that holds one row per player, keyed by `player_key`: all there
 * is of a character apart from what they built, buried and dropped. Playtest
 * resets and deleting a character both clear exactly these, so a table added
 * here is forgotten by both.
 */
const PER_PLAYER_TABLES = [
  'player_items',
  'players',
  'player_meals',
  'player_home_skills',
  'player_sentinel',
  'player_blueprint_progress',
  'player_discoveries',
  'player_expeditions',
  'player_fishing_collection',
  'player_pickups_taken',
  'player_gear',
] as const;

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
      this.resetStagingBuildsOnce();
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

    // Delete this player's character (decision 0108). Only ever reached through
    // `apps/web`, which puts the signed-in player's own key in the address.
    if (url.pathname.endsWith('/character') && request.method === 'DELETE') {
      const requestedKey = url.searchParams.get('player');
      if (requestedKey === null || !PLAYER_KEY_PATTERN.test(requestedKey)) {
        return Response.json({ ok: false, reason: 'Missing player' }, { status: 400 });
      }
      return Response.json(this.deleteCharacter(requestedKey));
    }

    // Who this player already is in this world, so the Home screen can show
    // their character instead of offering to make another (decision 0087).
    if (url.pathname.endsWith('/character')) {
      return Response.json(this.savedCharacter(url.searchParams.get('player')));
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
      skinIndex: identity?.skinIndex ?? skinToneIndex(DEFAULT_SKIN_TONE),
    } satisfies ConnectionAttachment);

    // A season asked for while testing, by the first one into an empty world.
    const askedWeather = url.searchParams.get('weather');
    const testWeather =
      this.env.WORLD_ALLOW_TEST_SEASON === '1' &&
      (askedWeather === 'storm' || askedWeather === 'blizzard')
        ? askedWeather
        : null;
    if (earlier === null && simulation.playerCount === 0) simulation.setTestWeather(testWeather);
    const season =
      testWeather === 'blizzard'
        ? 'winter'
        : testWeather === 'storm'
          ? 'summer'
          : this.testSeason(url);
    if (season !== null && earlier === null && simulation.playerCount === 0)
      simulation.setCalendarShift(
        clockShiftForSeason(simulation.seed, simulation.tick * TICK_MILLISECONDS, season),
      );

    if (earlier !== null) simulation.handOver(netId);
    else simulation.addPlayer(netId, playerKey ? this.loadPlayer(playerKey) : undefined, playerKey);
    // The axe and rod are main-hand gear too, but they are found in the world;
    // leaving them out keeps the hand-out inside the pack's slots.
    if (this.testGear(url))
      simulation.giveTestGear(netId, [
        'bag',
        ...GEAR_ITEMS.filter((item) => item !== 'axe' && item !== 'rod'),
      ]);
    server.send(encodeWelcome(netId, simulation.seed, simulation.tick, this.worldTimeMs()));
    // Whether the lake is ice, before anything that depends on it.
    server.send(encodeLakeIce(simulation.lakeFrozenByCalendar()));
    server.send(encodeWildfire(simulation.wildfireView()));
    // The tunnels and pits dug so far, before this player first moves.
    server.send(encodeDug(simulation.digsList(), true));
    // What you are carrying, and what is no longer lying about to be found.
    server.send(encodeInventory(inventoryEntries(simulation.inventoryOf(netId))));
    server.send(encodeHomeSkills(simulation.homeSkillsOf(netId)));
    server.send(encodeHomeSupplies(simulation.homeSuppliesOf(netId)));
    server.send(encodeMeal(simulation.mealStateOf(netId)));
    server.send(encodeDecorationState({ pieces: simulation.decorationsList(), reason: null }));
    server.send(encodePickupsTaken(simulation.takenPickupIdsOf(netId)));
    server.send(encodeTreeStates(simulation.changedTrees()));
    server.send(this.builtPropsFor(simulation, playerKey));
    server.send(encodeBuriedCaches(simulation.buriedCachesList()));
    // Where every stick and flower patch is now, and what anybody dropped.
    server.send(encodeGatherPatches(simulation.gatherPatchesList()));
    server.send(
      encodeRecoveryMarkers(
        simulation.buriedCachesList().filter((cache) => cache.ownerNetId === netId),
      ),
    );
    server.send(encodeDroppedPiles(simulation.droppedPilesList(netId)));
    server.send(encodeDiscoveries(simulation.discoveryStateOf(netId)));
    server.send(encodeGardenState(simulation.gardenStateOf(netId)));
    server.send(encodeExpeditionState(simulation.expeditionStateOf(netId)));
    server.send(encodeFishRecords(simulation.fishRecordsOf(netId)));
    // Any skeletons already out there, so they show up with the right look.
    server.send(encodeRaiders(simulation.raidersList()));
    for (const raider of simulation.raidersList())
      if (raider.kind === 'sentinel')
        server.send(encodeRaiderVitals(raider.id, simulation.raids.maxHitsOf(raider.id)));
    server.send(encodeHunger({ netId, hunger: simulation.hungerOf(netId), ate: null }));
    server.send(
      encodeHealth({ netId, health: simulation.healthOf(netId), knockedOut: false, dodged: false }),
    );
    // Who else is already here. This player's own Hello, sent right after
    // Welcome, is what tells everybody else about them in turn.
    server.send(encodeRoster(this.currentRoster()));
    // To everybody, so those already here see what the newcomer holds and wears.
    this.broadcast(encodeEquipped(simulation.equippedList()));
    this.broadcast(encodeWorn(simulation.wornList()));
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
      this.announceEquipped(simulation);
      return;
    }
    if (decoded.type === 'digTarget') {
      // Only remembered: the swing checks it when it lands.
      simulation.setDigTarget(attachment.netId, decoded.target);
      return;
    }
    if (decoded.type === 'loot') {
      simulation.requestLoot(attachment.netId, decoded);
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
      const before = simulation.homeSkillsOf(attachment.netId);
      simulation.useItem(attachment.netId, decoded.item);
      if (simulation.homeSkillsOf(attachment.netId) !== before) {
        this.ctx.storage.transactionSync(() => this.savePlayer(simulation, attachment));
        this.trySend(ws, encodeHomeSkills(simulation.homeSkillsOf(attachment.netId)));
        this.trySend(
          ws,
          encodeInventory(inventoryEntries(simulation.inventoryOf(attachment.netId))),
        );
      }
      this.announceHunger(simulation);
      this.announceMeals(simulation);
      this.announceEquipped(simulation);
      return;
    }
    if (decoded.type === 'gear') {
      // Settled the moment it arrives, like crafting; the server may refuse
      // (decision 0113), and only the one who asked is told so.
      const netId = attachment.netId;
      const change =
        decoded.action === 'wear'
          ? simulation.wearGear(netId, decoded.item, decoded.slot)
          : decoded.action === 'takeOff'
            ? simulation.takeOffGear(netId, decoded.slot)
            : simulation.swapGear(netId, decoded.from, decoded.to);
      if (!change.ok) {
        this.trySend(ws, encodeGearRefused(change.reason));
        return;
      }
      this.ctx.storage.transactionSync(() => this.savePlayer(simulation, attachment));
      this.trySend(ws, encodeInventory(inventoryEntries(simulation.inventoryOf(netId))));
      this.announceWorn(simulation);
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
    if (decoded.type === 'expedition') {
      const result = simulation.requestExpedition(attachment.netId, decoded);
      if (result.notice === 'accepted' || result.notice === 'claimed')
        this.ctx.storage.transactionSync(() => this.savePlayer(simulation, attachment));
      this.trySend(ws, encodeExpeditionState(result));
      if (result.notice === 'claimed')
        this.trySend(
          ws,
          encodeInventory(inventoryEntries(simulation.inventoryOf(attachment.netId))),
        );
      return;
    }
    if (decoded.type === 'decoration') {
      const result = simulation.requestDecoration(attachment.netId, decoded);
      if (result.reason === null && attachment.playerKey !== null) {
        this.ctx.storage.transactionSync(() => {
          this.savePlayer(simulation, attachment);
          this.writeMeta('home-decorations', JSON.stringify(result.pieces));
        });
        this.sendPacks(simulation, new Set([attachment.netId]));
        this.broadcast(encodeDecorationState(result));
      } else this.trySend(ws, encodeDecorationState(result));
      return;
    }
    if (decoded.type === 'garden') {
      const result = simulation.requestGarden(attachment.netId, decoded);
      if (result.reason === null && decoded.action !== 'inspect' && attachment.playerKey !== null) {
        this.ctx.storage.transactionSync(() => {
          this.savePlayer(simulation, attachment);
          this.writeGarden(result);
        });
        this.trySend(
          ws,
          encodeInventory(inventoryEntries(simulation.inventoryOf(attachment.netId))),
        );
        this.announceEquipped(simulation);
        this.announceGardens(simulation);
      }
      this.trySend(ws, encodeGardenState(result));
      return;
    }
    if (decoded.type === 'chest') {
      const result = simulation.requestChest(attachment.netId, decoded);
      if (result.moved > 0 && attachment.playerKey !== null) {
        // Save both sides atomically: reconnecting after a transfer cannot duplicate or lose items.
        this.ctx.storage.transactionSync(() => {
          this.savePlayer(simulation, attachment);
          this.ctx.storage.sql.exec(
            'INSERT INTO home_chests (home_id, slots) VALUES (?, ?) ON CONFLICT(home_id) DO UPDATE SET slots = excluded.slots',
            result.homeId,
            JSON.stringify(result.slots),
          );
        });
        ws.send(encodeInventory(inventoryEntries(simulation.inventoryOf(attachment.netId))));
        this.announceEquipped(simulation);
      }
      // Private, never broadcast to other players or visitors.
      ws.send(encodeChestState(result));
      ws.send(encodeHomeSupplies(simulation.homeSuppliesOf(attachment.netId)));
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
      this.handleHello(
        ws,
        attachment,
        decoded.name,
        decoded.character,
        decoded.color,
        decoded.skin,
      );
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
      // Somebody leaving a boat out on the water has it put ashore for them.
      this.announceBoats(simulation);
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
    this.announceDiscoveries(simulation);
    this.announceCollections(simulation);
    this.announcePickupRefusals(simulation);
    this.announceDigRefusals(simulation);
    this.announceChopping(simulation);
    this.announceTreeChanges(simulation);
    this.announceCatching(simulation);
    this.announceThreatHits(simulation);
    this.announceRaids(simulation);
    this.announceBuilding(simulation);
    this.announceLakeIce(simulation);
    this.announceDigging(simulation);
    this.announceWildfire(simulation);
    this.announceBoats(simulation);
    this.announceBrokenBoats(simulation);
    this.announceFishing(simulation);
    this.announceHunger(simulation);
    this.announceCooking(simulation);
    this.announceEquipped(simulation);
    this.announceWorn(simulation);
    this.announceHealth(simulation);
    this.announceExpeditions(simulation);
    this.announceMeals(simulation);
    this.announceBuriedCaches(simulation);
    this.announceRegrowth(simulation, startedAt);
    this.announcePatches(simulation, startedAt);
    this.announcePiles(simulation, startedAt);
    this.announceCampfireLighting(simulation, startedAt);
    this.announceRemovedBuilds(simulation, startedAt);
    this.announceSpaceChanges(simulation);
    if (simulation.tick % TICK_HZ === 0) this.announceGardens(simulation);
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
   * Tell whoever picked something up this tick what they now carry and which
   * pickups are theirs to find no more. Every character finds their own axe,
   * bag and rod (decision 0109), so what one player took is nobody else's
   * news: the others see the bend to pick it up, as they always have, and
   * nothing about what they can still find changes.
   *
   * It is written to storage straight away rather than waiting for the next
   * save, together with the pack that now holds it: finding the axe is not
   * something anybody should have to do twice.
   */
  private announcePickups(simulation: WorldSimulation): void {
    const events = simulation.drainPickupEvents();
    if (events.length === 0) return;

    const takers = new Set(events.map((event) => event.netId));
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null || !takers.has(attachment.netId)) continue;

      const items = inventoryEntries(simulation.inventoryOf(attachment.netId));
      const { playerKey } = attachment;
      if (playerKey !== null) {
        this.ctx.storage.transactionSync(() => {
          for (const event of events)
            if (event.netId === attachment.netId) this.writeTakenPickup(playerKey, event.pickupId);
          this.writePlayerItems(playerKey, items);
        });
      }
      this.trySend(ws, encodePickupsTaken(simulation.takenPickupIdsOf(attachment.netId)));
      this.trySend(ws, encodeInventory(items));
      this.trySend(ws, encodeHomeSupplies(simulation.homeSuppliesOf(attachment.netId)));
    }
  }

  private announceCollections(simulation: WorldSimulation): void {
    const events = simulation.drainCollectionEvents();
    for (let start = 0; start < events.length; start += MAX_COLLECTIONS_PER_MESSAGE) {
      this.broadcast(encodeCollected(events.slice(start, start + MAX_COLLECTIONS_PER_MESSAGE)));
    }
  }

  /** A swing that dug nothing is only the digger's business. */
  private announceDigRefusals(simulation: WorldSimulation): void {
    const events = simulation.drainDigRefusals();
    if (events.length === 0) return;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      for (const event of events) {
        if (event.netId === attachment?.netId) this.trySend(ws, encodeDigRefused(event.reason));
      }
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
  private announceExpeditions(simulation: WorldSimulation): void {
    const changes = simulation.drainExpeditionChanges();
    if (changes.length === 0) return;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const update = changes.find((change) => change.netId === attachment.netId);
      if (update === undefined) continue;
      this.ctx.storage.transactionSync(() => this.savePlayer(simulation, attachment));
      this.trySend(ws, encodeExpeditionState(update.state));
      if (update.state.notice === 'claimed')
        this.trySend(
          ws,
          encodeInventory(inventoryEntries(simulation.inventoryOf(attachment.netId))),
        );
    }
  }
  private announceDiscoveries(simulation: WorldSimulation): void {
    const events = simulation.drainDiscoveryChanges();
    if (events.length === 0) return;
    this.ctx.storage.transactionSync(() => {
      for (const ws of this.ctx.getWebSockets()) {
        const attachment = this.attachmentFor(ws);
        if (attachment === null || !events.some((e) => e.netId === attachment.netId)) continue;
        this.savePlayer(simulation, attachment);
      }
    });
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      for (const event of events)
        if (event.netId === attachment?.netId) {
          this.trySend(ws, encodeDiscoveries(event.state));
          this.trySend(ws, encodeInventory(inventoryEntries(simulation.inventoryOf(event.netId))));
        }
    }
  }

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

    for (const event of events) {
      this.broadcast(encodeTreeHit(event.treeId, event.swingsLeft, event.netId));
    }

    // Only the trees this swing touched: a forest has over a thousand, and
    // neither everybody's connection nor the database should be sent them all
    // for the sake of one chop. A tree that was only hit has nothing new to
    // look like, so only a felled one is announced.
    this.announceTreeChanges(simulation);
  }

  /**
   * Tell everybody how the trees that just changed now stand, and write them
   * to storage straight away rather than at the next save: nobody should have
   * to chop the same tree twice.
   */
  private announceTreeChanges(simulation: WorldSimulation): void {
    const changed = simulation.drainTreeChanges();
    if (changed.length === 0) return;
    const looks = simulation.changedTrees(changed);
    if (looks.length > 0) this.broadcast(encodeTreeStates(looks, false));
    for (const tree of simulation.persistableTrees(changed)) this.writeTree(tree);
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
  private savedEncounterRest = '[]';

  private announceRaids(simulation: WorldSimulation): void {
    if (simulation.drainRaidersChanged()) {
      const rest = JSON.stringify(simulation.encounterRestState());
      if (rest !== this.savedEncounterRest) {
        this.ctx.storage.transactionSync(() => {
          this.writeMeta('encounterRest', rest);
          this.writeMeta('tick', String(simulation.tick));
          this.writeMeta('wildfire', simulation.wildfire.save());
        });
        this.savedEncounterRest = rest;
      }
      this.broadcast(encodeRaiders(simulation.raidersList()));
      for (const raider of simulation.raidersList())
        if (raider.kind === 'sentinel')
          this.broadcast(encodeRaiderVitals(raider.id, simulation.raids.maxHitsOf(raider.id)));
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
    const feedback = simulation.drainHomeBuildFeedback();
    if (events.length === 0) {
      for (const ws of this.ctx.getWebSockets()) {
        const netId = this.attachmentFor(ws)?.netId;
        for (const result of feedback)
          if (result.netId === netId) this.trySend(ws, encodeHomeBuildFeedback(result));
      }
      return;
    }

    this.ctx.storage.transactionSync(() => {
      for (const event of events) {
        this.writeBuiltProp(event.prop, event.ownerKey);
        if (isHomeKind(event.prop.kind))
          this.ctx.storage.sql.exec(
            'INSERT INTO home_chests (home_id, slots) VALUES (?, ?) ON CONFLICT(home_id) DO UPDATE SET slots = excluded.slots',
            event.prop.id,
            JSON.stringify(simulation.chestSlots(event.prop.id)),
          );
        if (event.ownerKey !== null)
          this.writePlayerItems(
            event.ownerKey,
            inventoryEntries(simulation.inventoryOf(event.netId)),
          );
      }
    });
    this.broadcastBuiltProps(simulation);
    this.sendPacks(simulation, new Set(events.map((event) => event.netId)));
    for (const ws of this.ctx.getWebSockets()) {
      const netId = this.attachmentFor(ws)?.netId;
      for (const result of feedback)
        if (result.netId === netId) this.trySend(ws, encodeHomeBuildFeedback(result));
    }
  }

  private lastWildfireSaved = '';
  private announceWildfire(simulation: WorldSimulation): void {
    if (simulation.tick % TICK_HZ !== 0) return;
    const saved = simulation.wildfire.save();
    const changed = saved !== this.lastWildfireSaved;
    if (changed || simulation.wildfire.fires.size > 0)
      this.broadcast(encodeWildfire(simulation.wildfireView()));
    if (!changed) return;
    this.lastWildfireSaved = saved;
    this.ctx.storage.transactionSync(() => {
      this.writeMeta('wildfire', saved);
      this.writeMeta('tick', String(simulation.tick));
    });
  }

  /**
   * Somebody dug (decision 0114): save each new slab and tell everybody.
   * Sent to the whole world for now, which a cap of 20,000 digs keeps small
   * (a join message under 150 kB); nearby-only sending comes with the chunks.
   */
  private announceDigging(simulation: WorldSimulation): void {
    const digs = simulation.drainDigNews();
    if (digs.length === 0) return;
    for (const dig of digs) this.writeDig(dig);
    this.broadcast(encodeDug(digs, false));
  }

  private loadDigs(): Dig[] {
    return this.ctx.storage.sql
      .exec<{ ix: number; iy: number; iz: number; dir: number }>(
        'SELECT ix, iy, iz, dir FROM dug_slabs ORDER BY seq',
      )
      .toArray()
      .map((row) => ({ ix: row.ix, iy: row.iy, iz: row.iz, dir: row.dir as Dig['dir'] }));
  }

  private writeDig(dig: Dig): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO dug_slabs (ix, iy, iz, dir) VALUES (?, ?, ?, ?)',
      dig.ix,
      dig.iy,
      dig.iz,
      dig.dir,
    );
  }

  /**
   * The lake froze over or thawed (decision 0095): tell everybody, so their
   * browsers let them walk out on it, or not. Anybody stepped out of a boat or
   * put ashore by the change is announced with the rest of the boats.
   */
  private announceLakeIce(simulation: WorldSimulation): void {
    const frozen = simulation.drainLakeFreezeChange();
    if (frozen !== null) this.broadcast(encodeLakeIce(frozen));
  }

  /**
   * The season a browser asked to see with `?season=` (decision 0089), but
   * only where this server is set up for testing: local runs, the browser
   * tests and previews. The real worlds never take it.
   */
  /**
   * Whether a browser asked for one of every piece of gear with `?gear=`,
   * only where this server is set up for testing (decision 0113): gear cannot
   * be found in the world yet, so a preview needs another way to try it on.
   */
  private testGear(url: URL): boolean {
    return this.env.WORLD_ALLOW_TEST_GEAR === '1' && url.searchParams.has('gear');
  }

  private testSeason(url: URL): SeasonId | null {
    if (this.env.WORLD_ALLOW_TEST_SEASON !== '1') return null;
    const asked = url.searchParams.get('season');
    return SEASONS.find((season) => season === asked) ?? null;
  }

  /**
   * Somebody climbed into or out of a rowboat: tell everybody, so it is drawn
   * under its rider or moored where it was left, and write down where it is.
   * Only these moments are sent: while a boat is being rowed, its rider's own
   * position in every snapshot is where it is (see decision 0093).
   */
  private announceBoats(simulation: WorldSimulation): void {
    const boats = simulation.drainBoatChanges();
    if (boats.length === 0) return;
    this.ctx.storage.transactionSync(() => {
      for (const boat of boats)
        this.ctx.storage.sql.exec(
          'UPDATE built_props SET x = ?, z = ?, yaw = ? WHERE id = ?',
          boat.x,
          boat.z,
          boat.yaw,
          boat.id,
        );
    });
    this.broadcastBuiltProps(simulation);
  }

  /**
   * A boat fell apart because its owner was knocked out with it cut off on an
   * island (decision 0094): forget it for good, and tell everybody it is gone.
   * The pile of materials it left is announced with every other pile.
   */
  private announceBrokenBoats(simulation: WorldSimulation): void {
    const broken = simulation.drainBrokenBoats();
    if (broken.length === 0) return;
    this.ctx.storage.transactionSync(() => {
      for (const id of broken)
        this.ctx.storage.sql.exec('DELETE FROM built_props WHERE id = ?', id);
    });
    this.broadcastBuiltProps(simulation);
  }

  /**
   * Tell everybody what happened at the water, and tell whoever landed a fish
   * what is in their pack now.
   */
  private announceFishing(simulation: WorldSimulation): void {
    const events = simulation.drainFishingEvents();
    const changed = new Set(simulation.drainFishRecordChanges()),
      reels = new Map(simulation.drainReelChanges().map((update) => [update.netId, update.state]));
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      if (changed.has(attachment.netId)) {
        this.ctx.storage.transactionSync(() => this.savePlayer(simulation, attachment));
        this.trySend(ws, encodeFishRecords(simulation.fishRecordsOf(attachment.netId)));
      }
      const reel = reels.get(attachment.netId);
      if (reel !== undefined) this.trySend(ws, encodeRareReel(reel));
    }
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
      if (event !== undefined) {
        if (ate.has(attachment.netId))
          this.ctx.storage.transactionSync(() => this.savePlayer(simulation, attachment));
        this.trySend(ws, encodeHunger(event));
      }
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
  private announceMeals(simulation: WorldSimulation): void {
    const changes = simulation.drainMealChanges();
    if (changes.size === 0) return;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const meal = changes.get(attachment.netId);
      if (meal !== undefined) this.trySend(ws, encodeMeal(meal));
    }
  }

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
        this.trySend(ws, encodeGardenState(simulation.gardenStateOf(attachment.netId)));
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

    const changedPlayers = new Set(changes.map((change) => change.netId));
    this.ctx.storage.transactionSync(() => {
      for (const change of changes) {
        if (change.kind !== 'dugUp') this.writeBuriedCache(change.cache);
        else this.deleteBuriedCache(change.cacheId);
      }
      for (const ws of this.ctx.getWebSockets()) {
        const attachment = this.attachmentFor(ws);
        if (attachment !== null && changedPlayers.has(attachment.netId))
          this.savePlayer(simulation, attachment);
      }
    });

    const byNetId = new Map(
      changes.map((change) => [change.netId, { netId: change.netId, kind: change.kind }]),
    );
    const caches = simulation.buriedCachesList();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const event = byNetId.get(attachment.netId);
      if (event !== undefined) this.trySend(ws, encodeCache(event));
      this.trySend(
        ws,
        encodeRecoveryMarkers(caches.filter((cache) => cache.ownerNetId === attachment.netId)),
      );
    }
    this.sendPacks(simulation, new Set(byNetId.keys()));

    this.broadcast(encodeBuriedCaches(caches));
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
      this.trySend(ws, encodeHomeSupplies(simulation.homeSuppliesOf(attachment.netId)));
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

    this.announceTreeChanges(simulation);
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
    simulation.updateWeather(nowMs);
    const weatherCycle = simulation.drainWeatherCycleChange();
    simulation.fadeDroppedPiles(nowMs);
    const changed = simulation.drainPileChanges();
    const progress = new Set(simulation.drainBlueprintProgressChanges());
    const sentinelProgress = new Set(simulation.drainSentinelProgressChanges());
    if (
      changed.length === 0 &&
      progress.size === 0 &&
      sentinelProgress.size === 0 &&
      weatherCycle === null
    )
      return;
    // Weather cursor, windfalls and blueprint progress save with their rewards.
    this.ctx.storage.transactionSync(() => {
      if (weatherCycle !== null) this.writeMeta('weather-cycle', String(weatherCycle));
      for (const id of changed) {
        const pile = simulation.persistedPile(id);
        if (pile === null) this.deletePile(id);
        else this.writePile(pile);
      }
      for (const ws of this.ctx.getWebSockets()) {
        const attachment = this.attachmentFor(ws);
        if (attachment?.playerKey != null && sentinelProgress.has(attachment.netId))
          this.writeSentinel(
            attachment.playerKey,
            simulation.sentinelVictoriesOf(attachment.netId),
          );
        if (attachment?.playerKey != null && progress.has(attachment.netId))
          this.writeBlueprintProgress(
            attachment.playerKey,
            simulation.blueprintMissesOf(attachment.netId),
          );
      }
    });
    if (changed.length === 0) return;
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment !== null)
        this.trySend(ws, encodeDroppedPiles(simulation.droppedPilesList(attachment.netId)));
    }
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
   * Take away every abandoned build whose time is up (decision 0108), and tell
   * everybody. Run every tick and once when the world wakes, the same way
   * `announceCampfireLighting` is, so a world nobody was in still clears
   * whatever ran out meanwhile before the first player sees it.
   */
  private announceRemovedBuilds(simulation: WorldSimulation, nowMs: number): void {
    const removed = simulation.removeExpiredBuilds(nowMs);
    if (removed.length === 0) return;

    const sql = this.ctx.storage.sql;
    this.ctx.storage.transactionSync(() => {
      for (const id of removed) {
        sql.exec('DELETE FROM built_props WHERE id = ?', id);
        sql.exec('DELETE FROM home_chests WHERE home_id = ?', id);
        sql.exec('DELETE FROM home_gardens WHERE home_id = ?', id);
      }
      this.writeMeta('home-decorations', JSON.stringify(simulation.decorationsList()));
    });
    this.broadcastBuiltProps(simulation);
    this.broadcast(encodeDecorationState({ pieces: simulation.decorationsList(), reason: null }));
    this.announceSpaceChanges(simulation);
  }

  /**
   * Delete a player's character and let go of everything about it (decision
   * 0108). What they were carrying, where they stood, their map, their fish,
   * their home unlocks and their first finds are gone at once, and so are the
   * caches a knockout buried for them. What they built stays standing but
   * locked for a while (`WORLD_ABANDONED_SECONDS`, half an hour), then goes
   * all together - see `announceRemovedBuilds`.
   *
   * One path whether the player is in the world or not: a sleeping world is
   * woken for it, and put back to sleep afterwards if nobody is there.
   * Deleting twice is harmless - the second time there is nothing left.
   */
  deleteCharacter(playerKey: string): { ok: true; abandonedBuilds: number } {
    const simulation = this.ensureSimulation();
    const nowMs = Date.now();

    // Every connection playing as them - the tab they pressed the button in,
    // and any other - is told, and forgotten without being saved again.
    const departed: { ws: WebSocket; netId: number }[] = [];
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment?.playerKey !== playerKey) continue;
      simulation.removePlayer(attachment.netId);
      departed.push({ ws, netId: attachment.netId });
      this.letGo(ws, CLOSE_CHARACTER_DELETED, 'Character deleted');
    }
    // Anybody rowing was put ashore by that.
    this.announceBoats(simulation);

    const forgotten = simulation.forgetCharacter(playerKey, nowMs, this.abandonedLifetimeMs());
    this.ctx.storage.transactionSync(() => {
      for (const { prop, expiresAtMs } of forgotten.abandoned) {
        this.ctx.storage.sql.exec(
          'UPDATE built_props SET owner_key = ?, locked = 1, expires_at_ms = ? WHERE id = ?',
          ABANDONED_OWNER,
          expiresAtMs,
          prop.id,
        );
      }
      for (const cacheId of forgotten.cacheIds) this.deleteBuriedCache(cacheId);
      for (const table of PER_PLAYER_TABLES)
        this.ctx.storage.sql.exec(`DELETE FROM ${table} WHERE player_key = ?`, playerKey);
    });

    // Their piles, then what everybody else needs to hear.
    this.announcePiles(simulation, nowMs);
    this.broadcastBuiltProps(simulation);
    this.broadcast(encodeBuriedCaches(simulation.buriedCachesList()));
    this.announceSpaceChanges(simulation);
    for (const { ws, netId } of departed) this.broadcast(encodePlayerLeft(netId), ws);

    if (simulation.playerCount === 0) {
      this.save(simulation);
      this.stopTicking();
      this.releaseSimulation();
    }
    return { ok: true, abandonedBuilds: forgotten.abandoned.length };
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
   * asked for, remember it for next time, and let everybody know. Only the
   * first introduction counts: after that the character is theirs for good.
   */
  private handleHello(
    ws: WebSocket,
    attachment: ConnectionAttachment,
    rawName: string,
    requestedCharacter: CharacterId,
    color: TintColorId,
    skin: SkinToneId,
  ): void {
    // One character per player per world (decision 0087). Whoever already has
    // a name here keeps it: what a returning browser says is ignored, and only
    // the roster is repeated so the others hear they have arrived. A connection
    // with no player key has no character to protect and may say who it is again.
    if (attachment.playerKey !== null && attachment.name !== null) {
      this.broadcast(encodeRoster(this.currentRoster()));
      return;
    }

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
      skinIndex: skinToneIndex(skin),
    };
    ws.serializeAttachment(updated);

    if (attachment.playerKey !== null) {
      this.writePlayerIdentity(
        attachment.playerKey,
        name,
        updated.characterIndex,
        updated.colorIndex,
        skinToneIndex(skin),
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
        skin: skinToneFromIndex(attachment.skinIndex ?? 0) ?? DEFAULT_SKIN_TONE,
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
   * Tell everybody what everybody currently wears, whole, whenever any one
   * player changes it (decision 0113). As public as what is in your hand.
   */
  private announceWorn(simulation: WorldSimulation): void {
    if (simulation.drainWornEvents().length === 0) return;
    this.broadcast(encodeWorn(simulation.wornList()));
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
      reedRegrowMinSeconds: this.reedRegrowMinSeconds(),
      hungerEmptyAfterSeconds: this.hungerEmptyAfterSeconds(),
      raidIntervalSeconds: this.raidIntervalSeconds(),
      forestEncounters: (this.raidIntervalSeconds() ?? 240) < 86400,
    });
    this.simulation = simulation;
    const weatherCycle = this.readMeta('weather-cycle');
    simulation.restoreWeatherCycle(weatherCycle === null ? null : Number(weatherCycle));
    simulation.restoreTrees(this.loadTrees());
    this.expireOrphanedBuilds();
    simulation.restoreBuiltProps(this.loadBuiltProps());
    const decor = this.readMeta('home-decorations');
    if (decor !== null) {
      try {
        const parsed: unknown = JSON.parse(decor);
        if (Array.isArray(parsed)) simulation.restoreDecorations(parsed as HomeDecoration[]);
      } catch {
        console.error('Invalid saved home decorations');
      }
    }
    for (const row of this.ctx.storage.sql.exec<{ home_id: number; plots: string }>(
      'SELECT home_id, plots FROM home_gardens',
    )) {
      try {
        simulation.restoreGarden(row.home_id, JSON.parse(row.plots));
      } catch {
        console.error('Invalid saved garden', row.home_id);
      }
    }
    for (const row of this.ctx.storage.sql.exec<{ home_id: number; slots: string }>(
      'SELECT home_id, slots FROM home_chests',
    )) {
      try {
        simulation.restoreChest(row.home_id, JSON.parse(row.slots));
      } catch {
        console.error('Invalid saved chest', row.home_id);
      }
    }
    simulation.restoreBuriedCaches(this.loadBuriedCaches());
    simulation.restorePatches(this.loadPatches());
    simulation.restoreDigs(this.loadDigs());
    const encounterRest = this.readMeta('encounterRest');
    this.savedEncounterRest = encounterRest ?? '[]';
    if (encounterRest !== null) {
      try {
        const parsed: unknown = JSON.parse(encounterRest);
        if (
          Array.isArray(parsed) &&
          parsed.every(
            (row) =>
              Array.isArray(row) &&
              row.length === 2 &&
              row.every((value) => typeof value === 'number'),
          )
        )
          simulation.restoreEncounterRest(parsed as [number, number][]);
      } catch {
        /* An older or damaged metadata row must not prevent joining. */
      }
    }
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
    const fire = this.readMeta('wildfire');
    if (fire !== null) simulation.restoreWildfire(fire);
    // A sleeping world counts nothing, so anything due back is brought back
    // here, before the first snapshot goes out. Otherwise somebody walking in
    // an hour later would be shown the stump they left and then watch it turn
    // into a tree a tick afterwards.
    this.announceRegrowth(simulation, Date.now());
    this.announcePatches(simulation, Date.now());
    this.announcePiles(simulation, Date.now());
    this.announceCampfireLighting(simulation, Date.now());
    this.announceRemovedBuilds(simulation, Date.now());
    if (simulation.playerCount > 0) this.startTicking();
    return simulation;
  }

  private writeGarden(garden: Pick<GardenState, 'homeId' | 'plots'>): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO home_gardens (home_id, plots) VALUES (?, ?) ON CONFLICT(home_id) DO UPDATE SET plots=excluded.plots',
      garden.homeId,
      JSON.stringify(garden.plots),
    );
  }
  private announceGardens(simulation: WorldSimulation): void {
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = this.attachmentFor(ws);
      if (attachment === null) continue;
      const state = simulation.gardenStateOf(attachment.netId);
      if (state.homeId !== 0) this.trySend(ws, encodeGardenState(state));
    }
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
   * How long a cut-clean bed of mature reeds takes to come back, if the
   * environment says. Only honoured when it is a sensible positive number,
   * the same as `regrowMinSeconds`.
   */
  private reedRegrowMinSeconds(): number | undefined {
    const configured = Number(this.env.WORLD_REED_REGROW_SECONDS);
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

  /**
   * How long a deleted character's builds stay standing before they go, if the
   * environment says. Only honoured when it is a sensible positive number, so a
   * typo in a dashboard variable cannot make them vanish at once.
   */
  private abandonedLifetimeMs(): number {
    const configured = Number(this.env.WORLD_ABANDONED_SECONDS);
    const seconds =
      Number.isFinite(configured) && configured > 0 ? configured : ABANDONED_BUILD_SECONDS;
    return seconds * 1000;
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
    sql.exec(
      'CREATE TABLE IF NOT EXISTS player_fishing_collection (player_key TEXT PRIMARY KEY, state TEXT NOT NULL)',
    );
    sql.exec(
      'CREATE TABLE IF NOT EXISTS player_expeditions (player_key TEXT PRIMARY KEY, state TEXT NOT NULL)',
    );
    sql.exec(
      'CREATE TABLE IF NOT EXISTS player_meals (player_key TEXT PRIMARY KEY, item_index INTEGER, ticks_left INTEGER NOT NULL)',
    );
    sql.exec(
      'CREATE TABLE IF NOT EXISTS player_home_skills (player_key TEXT PRIMARY KEY, skills INTEGER NOT NULL)',
    );
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
    // What each character is wearing (decision 0113): one row per slot in use.
    sql.exec(`CREATE TABLE IF NOT EXISTS player_gear (
      player_key TEXT NOT NULL,
      slot INTEGER NOT NULL,
      item_index INTEGER NOT NULL,
      PRIMARY KEY (player_key, slot)
    )`);
    // The axe, bag and rod each character has already picked up. The clearing
    // itself is built from the seed, so only what has changed since has to be
    // stored, and every character finds their own copy (decision 0109).
    this.createPlayerPickups();
    sql.exec(
      'CREATE TABLE IF NOT EXISTS home_chests (home_id INTEGER PRIMARY KEY, slots TEXT NOT NULL)',
    );
    sql.exec(
      'CREATE TABLE IF NOT EXISTS home_gardens (home_id INTEGER PRIMARY KEY, plots TEXT NOT NULL)',
    );
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
    // 0 is the body's own skin (`SKIN_TONE_ORDER`), so a character saved before
    // skin tones existed keeps looking exactly as it did.
    this.addColumn('players', 'skin_index', 'INTEGER NOT NULL DEFAULT 0');
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
    // Only a build left behind by a deleted character sets this: the real time
    // it disappears (decision 0108). Null for everything still in use.
    this.addColumn('built_props', 'expires_at_ms', 'INTEGER');
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
    // Every shovel dig in the order made (decision 0114): a few bytes each, and
    // an untouched world has no rows at all.
    sql.exec(`CREATE TABLE IF NOT EXISTS dug_slabs (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      ix INTEGER NOT NULL,
      iy INTEGER NOT NULL,
      iz INTEGER NOT NULL,
      dir INTEGER NOT NULL
    )`);
    sql.exec(`CREATE TABLE IF NOT EXISTS gather_patches (
      patch_id INTEGER PRIMARY KEY,
      x REAL NOT NULL,
      z REAL NOT NULL,
      remaining INTEGER NOT NULL,
      generation INTEGER NOT NULL,
      emptied_at_ms INTEGER NOT NULL
    )`);
    sql.exec(
      'CREATE TABLE IF NOT EXISTS player_discoveries (player_key TEXT PRIMARY KEY, found INTEGER NOT NULL, claimed INTEGER NOT NULL)',
    );
    sql.exec(
      'CREATE TABLE IF NOT EXISTS player_blueprint_progress (player_key TEXT PRIMARY KEY, misses INTEGER NOT NULL)',
    );
    sql.exec(
      'CREATE TABLE IF NOT EXISTS player_sentinel (player_key TEXT PRIMARY KEY, victories INTEGER NOT NULL)',
    );
    // Whatever anybody dropped, until it is picked up or fades.
    sql.exec(`CREATE TABLE IF NOT EXISTS dropped_piles (
      id INTEGER PRIMARY KEY,
      item_index INTEGER NOT NULL,
      count INTEGER NOT NULL,
      x REAL NOT NULL,
      z REAL NOT NULL,
      dropped_at_ms INTEGER NOT NULL
    )`);
    this.addColumn('dropped_piles', 'owner_key', 'TEXT');
  }

  /**
   * The table of pickups each character has taken. A world saved before this
   * kept one list for the whole world, which it no longer reads. The
   * characters it already has keep what they are carrying as taken, so the
   * axe is not back on its stump for someone already holding it; anyone not
   * holding a thing finds their own, as everybody now does.
   */
  private createPlayerPickups(): void {
    const sql = this.ctx.storage.sql;
    const tableExists = (name: string): boolean =>
      sql
        .exec<{ name: string }>(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
          name,
        )
        .toArray().length > 0;
    const isNew = !tableExists('player_pickups_taken');
    sql.exec(`CREATE TABLE IF NOT EXISTS player_pickups_taken (
      player_key TEXT NOT NULL,
      pickup_id INTEGER NOT NULL,
      PRIMARY KEY (player_key, pickup_id)
    )`);
    if (!isNew || !tableExists('pickups_taken')) return;
    const found: readonly (readonly [number, ItemId])[] = [
      [AXE_PICKUP_ID, 'axe'],
      [ROD_PICKUP_ID, 'rod'],
      [BAG_PICKUP_ID, 'bag'],
    ];
    for (const [pickupId, item] of found) {
      sql.exec(
        'INSERT OR IGNORE INTO player_pickups_taken (player_key, pickup_id) ' +
          'SELECT player_key, ? FROM player_items WHERE item_index = ? ' +
          'AND EXISTS (SELECT 1 FROM pickups_taken WHERE pickup_id = ?)',
        pickupId,
        itemIndex(item),
        pickupId,
      );
    }
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
    const savedMeal = this.ctx.storage.sql
      .exec<{ item_index: number | null; ticks_left: number }>(
        'SELECT item_index,ticks_left FROM player_meals WHERE player_key=?',
        playerKey,
      )
      .toArray()[0];
    const discoveries = this.ctx.storage.sql
      .exec<{ found: number; claimed: number }>(
        'SELECT found, claimed FROM player_discoveries WHERE player_key = ?',
        playerKey,
      )
      .toArray()[0];
    return {
      takenPickups: this.loadTakenPickups(playerKey),
      expedition: this.readExpedition(playerKey),
      fishRecords: this.readFishRecords(playerKey),
      meal: mealFromSaved(
        savedMeal === undefined
          ? null
          : {
              item: savedMeal.item_index === null ? null : itemFromIndex(savedMeal.item_index),
              ticksLeft: savedMeal.ticks_left,
            },
      ),
      discoveriesFound: discoveries?.found ?? 0,
      discoveriesClaimed: discoveries?.claimed ?? 0,
      netId: 0,
      x: row.x,
      y: row.y,
      z: row.z,
      facingYaw: row.facing_yaw,
      items: this.loadPlayerItems(playerKey),
      sentinelVictories:
        this.ctx.storage.sql
          .exec<{ victories: number }>(
            'SELECT victories FROM player_sentinel WHERE player_key=?',
            playerKey,
          )
          .toArray()[0]?.victories ?? 0,
      homeSkills:
        this.ctx.storage.sql
          .exec<{ skills: number }>(
            'SELECT skills FROM player_home_skills WHERE player_key = ?',
            playerKey,
          )
          .toArray()[0]?.skills ?? 0,
      blueprintMisses:
        this.ctx.storage.sql
          .exec<{ misses: number }>(
            'SELECT misses FROM player_blueprint_progress WHERE player_key = ?',
            playerKey,
          )
          .toArray()[0]?.misses ?? 0,
      hunger: row.hunger,
      health: row.health,
      equippedItem:
        row.equipped_item_index === null ? null : itemFromIndex(row.equipped_item_index),
      explored: row.explored === null ? null : new Uint8Array(row.explored),
      worn: this.loadPlayerGear(playerKey),
    };
  }

  /**
   * The character a player made in this world, in the words the browser uses,
   * or `{ made: false }` if they have not made one (or the key is not one).
   */
  private savedCharacter(
    requestedKey: string | null,
  ):
    | { made: false }
    | { made: true; name: string; character: CharacterId; color: TintColorId; skin: SkinToneId } {
    if (requestedKey === null || !PLAYER_KEY_PATTERN.test(requestedKey)) return { made: false };
    const saved = this.loadPlayerIdentity(requestedKey);
    if (saved === undefined) return { made: false };
    return {
      made: true,
      name: saved.name,
      character: characterFromIndex(saved.characterIndex) ?? DEFAULT_CHARACTER,
      color: tintColorFromIndex(saved.colorIndex) ?? DEFAULT_TINT_COLOR,
      skin: skinToneFromIndex(saved.skinIndex) ?? DEFAULT_SKIN_TONE,
    };
  }

  /** A returning player's last-known name, tint and skin tone, if they ever sent a Hello. */
  private loadPlayerIdentity(
    playerKey: string,
  ): { name: string; characterIndex: number; colorIndex: number; skinIndex: number } | undefined {
    const rows = this.ctx.storage.sql
      .exec<{
        name: string | null;
        character_index: number;
        color_index: number;
        skin_index: number;
      }>(
        'SELECT name, character_index, color_index, skin_index FROM players WHERE player_key = ?',
        playerKey,
      )
      .toArray();
    const row = rows[0];
    if (row === undefined || row.name === null) return undefined;
    return {
      name: row.name,
      characterIndex: row.character_index,
      colorIndex: row.color_index,
      skinIndex: row.skin_index,
    };
  }

  private loadPlayerGear(playerKey: string): { slot: GearSlot; item: ItemId }[] {
    const rows = this.ctx.storage.sql
      .exec<{
        slot: number;
        item_index: number;
      }>('SELECT slot, item_index FROM player_gear WHERE player_key = ?', playerKey)
      .toArray();
    const worn: { slot: GearSlot; item: ItemId }[] = [];
    for (const row of rows) {
      const slot = gearSlotFromIndex(row.slot);
      const item = itemFromIndex(row.item_index);
      // A row from a build that knew a slot or piece this one does not.
      if (slot === null || item === null) continue;
      worn.push({ slot, item });
    }
    return worn;
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

  /**
   * Older playtest resets removed characters without retiring their builds.
   * Give only those orphaned builds an already-due deadline, then let the
   * normal removal path clear their collision, chest, garden and decorations.
   * Communal builds and the deletion grace period are left intact.
   */
  private expireOrphanedBuilds(): void {
    this.ctx.storage.sql.exec(
      'UPDATE built_props SET owner_key = ?, locked = 1, expires_at_ms = 0 ' +
        'WHERE owner_key IS NOT NULL AND owner_key != ? AND expires_at_ms IS NULL ' +
        'AND NOT EXISTS (SELECT 1 FROM players WHERE players.player_key = built_props.owner_key)',
      ABANDONED_OWNER,
      ABANDONED_OWNER,
    );
  }

  private loadBuiltProps(): (BuiltProp & {
    readonly ownerKey: string | null;
    readonly litUntilMs: number | null;
    readonly expiresAtMs: number | null;
  })[] {
    const props: (BuiltProp & {
      readonly ownerKey: string | null;
      readonly litUntilMs: number | null;
      readonly expiresAtMs: number | null;
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
        expires_at_ms: number | null;
      }>(
        'SELECT id, kind_index, x, z, owner_key, lit_until_ms, yaw, locked, expires_at_ms FROM built_props',
      )
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
        expiresAtMs: row.expires_at_ms,
      });
    }
    return props;
  }

  /**
   * Keep placement, ownership and lock intact when upgrading a home's kind.
   * Campfire lighting is saved separately by `writeCampfireLitState`.
   */
  private writeBuiltProp(prop: BuiltProp, ownerKey: string | null): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO built_props (id, kind_index, x, z, yaw, built_at_ms, owner_key) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind_index = excluded.kind_index',
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
    sql.exec('DELETE FROM buried_cache_items WHERE cache_id = ?', cache.id);
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
        owner_key: string | null;
      }>('SELECT id, item_index, count, x, z, dropped_at_ms, owner_key FROM dropped_piles')
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
        ...(row.owner_key === null ? {} : { ownerKey: row.owner_key }),
      });
    }
    return piles;
  }

  private writePile(pile: PersistedPile): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO dropped_piles (id, item_index, count, x, z, dropped_at_ms, owner_key) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?) ' +
        'ON CONFLICT(id) DO UPDATE SET item_index = excluded.item_index, ' +
        'count = excluded.count, x = excluded.x, z = excluded.z, ' +
        'dropped_at_ms = excluded.dropped_at_ms, owner_key = excluded.owner_key',
      pile.id,
      itemIndex(pile.item),
      pile.count,
      pile.x,
      pile.z,
      pile.droppedAtMs,
      pile.ownerKey ?? null,
    );
  }

  /** Picked up or faded: nothing keeps a pile around once it no longer exists. */
  private deletePile(id: number): void {
    this.ctx.storage.sql.exec('DELETE FROM dropped_piles WHERE id = ?', id);
  }

  private loadTakenPickups(playerKey: string): number[] {
    return this.ctx.storage.sql
      .exec<{ pickup_id: number }>(
        'SELECT pickup_id FROM player_pickups_taken WHERE player_key = ?',
        playerKey,
      )
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
    const equipped = simulation.packChoiceOf(attachment.netId);
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
    this.writePlayerGear(attachment.playerKey, wornEntries(simulation.wornOf(attachment.netId)));
    this.writeMeal(attachment.playerKey, simulation.mealStateOf(attachment.netId));
    this.writeExpedition(attachment.playerKey, simulation.expeditionStateOf(attachment.netId));
    this.writeFishRecords(attachment.playerKey, simulation.fishRecordsOf(attachment.netId));
    this.writeSentinel(attachment.playerKey, simulation.sentinelVictoriesOf(attachment.netId));
    this.writeHomeSkills(attachment.playerKey, simulation.homeSkillsOf(attachment.netId));
    this.writeBlueprintProgress(
      attachment.playerKey,
      simulation.blueprintMissesOf(attachment.netId),
    );
    const discoveries = simulation.discoveryStateOf(attachment.netId);
    this.writeDiscoveries(attachment.playerKey, discoveries.found, discoveries.claimed);
    const explored = simulation.exploredMapOf(attachment.netId);
    if (explored !== null) this.writePlayerExplored(attachment.playerKey, explored);
  }

  private writeSentinel(playerKey: string, victories: number): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO player_sentinel (player_key,victories) VALUES (?,?) ON CONFLICT(player_key) DO UPDATE SET victories=excluded.victories',
      playerKey,
      victories,
    );
  }
  private readFishRecords(playerKey: string): FishRecords {
    const row = this.ctx.storage.sql
      .exec<{ state: string }>(
        'SELECT state FROM player_fishing_collection WHERE player_key=?',
        playerKey,
      )
      .toArray()[0];
    try {
      return fishRecordsFromSaved(row === undefined ? null : JSON.parse(row.state));
    } catch {
      return fishRecordsFromSaved(null);
    }
  }
  private writeFishRecords(playerKey: string, state: FishRecords): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO player_fishing_collection (player_key,state) VALUES (?,?) ON CONFLICT(player_key) DO UPDATE SET state=excluded.state',
      playerKey,
      JSON.stringify(fishRecordsFromSaved(state)),
    );
  }
  private readExpedition(playerKey: string): ExpeditionState {
    const row = this.ctx.storage.sql
      .exec<{ state: string }>('SELECT state FROM player_expeditions WHERE player_key=?', playerKey)
      .toArray()[0];
    try {
      return expeditionFromSaved(row === undefined ? null : JSON.parse(row.state));
    } catch {
      return expeditionFromSaved(null);
    }
  }
  private writeExpedition(playerKey: string, state: ExpeditionState): void {
    const saved = expeditionFromSaved(state);
    this.ctx.storage.sql.exec(
      'INSERT INTO player_expeditions (player_key,state) VALUES (?,?) ON CONFLICT(player_key) DO UPDATE SET state=excluded.state',
      playerKey,
      JSON.stringify(saved),
    );
  }
  private writeMeal(playerKey: string, meal: MealState): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO player_meals (player_key,item_index,ticks_left) VALUES (?,?,?) ON CONFLICT(player_key) DO UPDATE SET item_index=excluded.item_index,ticks_left=excluded.ticks_left',
      playerKey,
      meal.item === null ? null : itemIndex(meal.item),
      meal.ticksLeft,
    );
  }

  private writeDiscoveries(playerKey: string, found: number, claimed: number): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO player_discoveries (player_key, found, claimed) VALUES (?, ?, ?) ON CONFLICT(player_key) DO UPDATE SET found = excluded.found, claimed = excluded.claimed',
      playerKey,
      found,
      claimed,
    );
  }

  private writeBlueprintProgress(playerKey: string, misses: number): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO player_blueprint_progress (player_key, misses) VALUES (?, ?) ON CONFLICT(player_key) DO UPDATE SET misses = excluded.misses',
      playerKey,
      misses,
    );
  }

  private writeHomeSkills(playerKey: string, skills: number): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO player_home_skills (player_key, skills) VALUES (?, ?) ON CONFLICT(player_key) DO UPDATE SET skills = excluded.skills',
      playerKey,
      skills,
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
   * four identity columns, exactly as it does for `writePlayer`'s own
   * columns, so this never clobbers a real saved position.
   */
  private writePlayerIdentity(
    playerKey: string,
    name: string,
    characterIndex: number,
    colorIndex: number,
    skinIndex: number,
  ): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO players ' +
        '(player_key, x, y, z, facing_yaw, hunger, health, name, character_index, color_index, skin_index, updated_at) ' +
        'VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(player_key) DO UPDATE SET ' +
        'name = excluded.name, character_index = excluded.character_index, ' +
        'color_index = excluded.color_index, skin_index = excluded.skin_index, ' +
        'updated_at = excluded.updated_at',
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
      skinIndex,
      Date.now(),
    );
  }

  private writePlayerGear(
    playerKey: string,
    worn: readonly { readonly slot: GearSlot; readonly item: ItemId }[],
  ): void {
    const sql = this.ctx.storage.sql;
    sql.exec('DELETE FROM player_gear WHERE player_key = ?', playerKey);
    for (const entry of worn) {
      sql.exec(
        'INSERT INTO player_gear (player_key, slot, item_index) VALUES (?, ?, ?)',
        playerKey,
        gearSlotIndex(entry.slot),
        itemIndex(entry.item),
      );
    }
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

  private writeTakenPickup(playerKey: string, pickupId: number): void {
    this.ctx.storage.sql.exec(
      'INSERT INTO player_pickups_taken (player_key, pickup_id) VALUES (?, ?) ' +
        'ON CONFLICT(player_key, pickup_id) DO NOTHING',
      playerKey,
      pickupId,
    );
  }

  /** Write everything worth keeping: the tick count and where everyone is. */
  private save(simulation: WorldSimulation): void {
    for (const garden of simulation.savedGardens()) this.writeGarden(garden);
    this.writeMeta('tick', String(simulation.tick));
    this.writeMeta('wildfire', simulation.wildfire.save());
    this.writeMeta('encounterRest', JSON.stringify(simulation.encounterRestState()));
    // Trees are written the moment they change; this only catches anything left over.
    for (const tree of simulation.persistableTrees(simulation.drainTreeChanges())) {
      this.writeTree(tree);
    }

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
      this.writePlayerGear(attachment.playerKey, player.worn ?? []);
      this.writeMeal(attachment.playerKey, mealFromSaved(player.meal));
      this.writeExpedition(attachment.playerKey, expeditionFromSaved(player.expedition));
      this.writeFishRecords(attachment.playerKey, fishRecordsFromSaved(player.fishRecords));
      this.writeSentinel(attachment.playerKey, player.sentinelVictories ?? 0);
      this.writeHomeSkills(attachment.playerKey, player.homeSkills ?? 0);
      this.writeBlueprintProgress(attachment.playerKey, player.blueprintMisses ?? 0);
      this.writeDiscoveries(
        attachment.playerKey,
        player.discoveriesFound ?? 0,
        player.discoveriesClaimed ?? 0,
      );
      if (player.explored != null) this.writePlayerExplored(attachment.playerKey, player.explored);
    }
  }

  /** A small summary, useful from a browser while playtesting. */
  status(): {
    players: number;
    savedCharacters: number;
    builtStructures: number;
    tick: number;
    seed: number;
    running: boolean;
    slowTicks: number;
  } {
    const simulation = this.simulation;
    return {
      players:
        simulation?.playerCount ??
        this.ctx.getWebSockets().filter((ws) => this.attachmentFor(ws) !== null).length,
      savedCharacters: this.ctx.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM players WHERE name IS NOT NULL')
        .one().count,
      builtStructures: this.ctx.storage.sql
        .exec<{ count: number }>('SELECT COUNT(*) AS count FROM built_props')
        .one().count,
      tick: simulation?.tick ?? this.loadTick(),
      seed: simulation?.seed ?? this.seed(),
      running: this.tickHandle !== null,
      slowTicks: this.slowTickCount,
    };
  }

  /** Clear the original staging test builds once, including ownerless legacy pieces. */
  private resetStagingBuildsOnce(): void {
    const reset = this.env.WORLD_STAGING_BUILD_RESET;
    if (!reset || this.ctx.id.toString() !== this.env.WORLD.idFromName('home-clearing').toString())
      return;
    if (this.readMeta('staging-build-reset') === reset) return;

    // Runs before any simulation is restored, so no live geometry or later
    // save can put the old buildings back. The marker and deletes are atomic.
    this.ctx.storage.transactionSync(() => {
      for (const table of ['built_props', 'home_chests', 'home_gardens'])
        this.ctx.storage.sql.exec(`DELETE FROM ${table}`);
      this.writeMeta('home-decorations', '[]');
      this.writeMeta('staging-build-reset', reset);
    });
    // Hibernatable sockets can survive a deployment. Reconnect them so their
    // browsers also discard the old buildings and any room they were inside.
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.close(1012, 'Staging structures reset; reconnecting');
      } catch {
        // The browser may already have left.
      }
    }
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
    // The players table is counted above, so read before anything is cleared.
    for (const table of PER_PLAYER_TABLES) sql.exec(`DELETE FROM ${table}`);
    return { ok: true, clearedPlayers };
  }
}
