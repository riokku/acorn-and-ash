import { createWorld, type Entity, type World } from 'koota';

import {
  INPUT_BACKLOG_CATCHUP_THRESHOLD,
  INTEREST_RADIUS,
  MAX_INPUTS_PER_TICK,
  MAX_QUEUED_INPUTS_PER_PLAYER,
  MAX_TREE_GENERATION,
  REGROW_MIN_SECONDS,
  SPAWN_POSITION,
  SPAWN_RING_RADIUS,
  SPRINT_REPORTING_SPEED,
  SWING_COOLDOWN_TICKS,
  TICK_SECONDS,
} from '../constants';
import { createCollisionWorld, type CollisionWorld } from '../collision/capsule';
import {
  AimYaw,
  Facing,
  Grounded,
  LastProcessedInput,
  NetworkId,
  PlayerTag,
  Position,
  Prop,
  StaticTag,
  Velocity,
} from '../ecs/traits';
import { PROP_KINDS, choppingRuleFor, propKindIndex } from '../data/props';
import { colliderFootprintRadius } from '../world/colliders';
import type { ItemId } from '../data/items';
import { replaceCollider } from '../collision/capsule';
import type { Vec3 } from '../math/vec3';
import {
  buildTestClearing,
  colliderForProp,
  stumpColliderFor,
  type Clearing,
  type PlacedPickup,
  type PlacedProp,
} from '../world/clearing';
import { createWildernessTerrain, type Terrain } from '../world/terrain';
import { castLanding } from '../world/water';
import { buildWilderness, type Wilderness } from '../world/wilderness';
import {
  addItem,
  hasItem,
  createInventory,
  inventoryEntries,
  inventoryFromEntries,
  type Inventory,
} from './inventory';
import { pickupInReach } from './pickups';
import { treeInReach, type ChopTarget } from './chopping';
import {
  CAST_COOLDOWN_TICKS,
  readCastInput,
  startCast,
  tickCast,
  type Cast,
  type CastEnd,
  type CastInput,
} from './fishing';
import { regrowDueAtMs, spotIsClear, treeAtGeneration } from './regrowth';
import {
  PlayerButton,
  createPlayerMotion,
  idleInput,
  isHeld,
  stepPlayer,
  type PlayerInput,
  type PlayerMotion,
} from './player';

export interface WorldSimulationOptions {
  readonly seed: number;
  /** Defaults to the generated wilderness terrain, built from `seed`. */
  readonly terrain?: Terrain;
  /** Skip spawning scenery entities. Only used by benchmarks. */
  readonly withProps?: boolean;
  /**
   * The shortest a felled tree takes to come back, in seconds. Trees return
   * somewhere between this and twice it.
   *
   * Turned right down for previews and local runs, so a tree growing back can
   * be watched rather than waited out. Left alone everywhere real.
   */
  readonly regrowMinSeconds?: number;
}

/**
 * One player as it appears in a snapshot.
 *
 * Velocity travels too. The client that owns this player needs it to re-run its
 * own movement from the server's answer, and for everybody else it lets the
 * client keep a late player gliding instead of freezing.
 */
export interface SnapshotEntity {
  netId: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  flags: number;
}

export const SnapshotFlag = {
  Moving: 1 << 0,
  Airborne: 1 << 1,
  /** Moving at sprint pace. Derived from speed, so shoving a tree is not a sprint. */
  Sprinting: 1 << 2,
} as const;

/** A player's saved state, as it goes into and comes out of storage. */
export interface PersistedPlayer {
  readonly netId: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly facingYaw: number;
  readonly items: readonly { readonly item: ItemId; readonly count: number }[];
}

/** Somebody picked something up. The world server turns these into messages. */
export interface PickupTaken {
  readonly netId: number;
  readonly pickupId: number;
  readonly item: ItemId;
}

/** A swing landed on a tree. */
export interface TreeChopped {
  readonly netId: number;
  readonly treeId: number;
  /** Swings still to go. Zero means it came down. */
  readonly swingsLeft: number;
  /** Logs that went into the chopper's pack, once it did. */
  readonly logsGained: number;
}

/** A tree's state, as it goes into and comes out of storage. */
export interface PersistedTree {
  readonly treeId: number;
  readonly swingsTaken: number;
  readonly felled: boolean;
  /**
   * When it was felled, in real time.
   *
   * Real time rather than ticks, because a world with nobody in it stops
   * ticking: a tree felled at midnight has to be back when somebody logs in at
   * one, having counted nothing in between.
   */
  readonly felledAtMs: number;
  /** How many times this spot has grown back. It decides the tree's size. */
  readonly generation: number;
}

/**
 * The turn after this one.
 *
 * The count is what both ends work the tree's size out from and it travels in
 * one byte, so a spot chopped hundreds of times stops counting rather than
 * growing a tree every browser would draw at a different size.
 */
function nextGeneration(generation: number): number {
  return Math.min(generation + 1, MAX_TREE_GENERATION);
}

/**
 * Something that happened at the water, for everybody to see.
 *
 * Everyone is told, not only the one fishing, so a float bobbing in the pond is
 * the same float for everybody standing round it.
 */
export type FishingEvent =
  | { readonly kind: 'cast'; readonly netId: number; readonly x: number; readonly z: number }
  | { readonly kind: 'bite'; readonly netId: number }
  /** `added` is how many went into the pack: none when it was already full. */
  | {
      readonly kind: 'caught';
      readonly netId: number;
      readonly item: ItemId;
      readonly added: number;
    }
  | { readonly kind: 'tooSoon' | 'tooLate' | 'walkedAway'; readonly netId: number };

/** A tree that has come back. */
export interface TreeRegrown {
  readonly treeId: number;
  readonly generation: number;
}

/** Everything the world knows about one tree. */
interface TreeState {
  swingsTaken: number;
  felled: boolean;
  felledAtMs: number;
  generation: number;
}

interface PlayerRuntime {
  readonly netId: number;
  readonly entity: Entity;
  readonly queue: PlayerInput[];
  readonly inventory: Inventory;
  /** Ticks left before this player may swing again. */
  swingCooldownTicks: number;
  /**
   * Whether the button was down in the last input, so a fresh press can be told
   * from one being held. Chopping is happy with a held button; a cast wants a
   * click.
   */
  swingWasHeld: boolean;
  /** Their line in the water, if they have one out. */
  cast: Cast | null;
  lastProcessedSeq: number;
  /** Inputs thrown away because the client was sending faster than it should. */
  droppedInputs: number;
}

/**
 * The authoritative world.
 *
 * This is the server's copy of the truth. It is plain TypeScript with no Worker
 * or browser APIs in it, so the same class runs inside the World Durable Object,
 * inside tests and inside the load-test benchmark.
 */
export class WorldSimulation {
  readonly world: World;
  readonly seed: number;
  readonly clearing: Clearing;
  /**
   * The generated forest beyond the clearing. Built once from the seed and
   * never touched again: none of it is ever chopped or picked up, so unlike
   * `clearing` it has no state worth keeping past construction.
   */
  readonly wilderness: Wilderness;
  readonly collision: CollisionWorld;
  readonly regrowMinSeconds: number;

  /** How many ticks have been simulated since the world was created. */
  tick = 0;

  /** Real time as of the tick being simulated, supplied by the caller. */
  private nowMs = 0;

  private readonly players = new Map<number, PlayerRuntime>();
  /** Pickups that somebody has already taken, by id. */
  private readonly takenPickups = new Set<number>();
  /** Drained by the world server each tick and turned into messages. */
  private readonly pickupEvents: PickupTaken[] = [];
  /** Every tree anybody has touched, by prop id. Untouched trees are not here. */
  private readonly trees = new Map<number, TreeState>();
  private readonly chopEvents: TreeChopped[] = [];
  private readonly regrowthEvents: TreeRegrown[] = [];
  private readonly fishingEvents: FishingEvent[] = [];
  /** Every cast in this world gets its own number, so no two share a roll. */
  private castCounter = 0;
  /**
   * The props as they stand right now.
   *
   * A tree that has grown back is a different size from the one the clearing
   * was built with, and reach, collision and drawing all have to agree about
   * which one is there.
   */
  private readonly standing: PlacedProp[];
  private spawnCounter = 0;
  /** Reused every tick so a busy world does not allocate per player. */
  private readonly scratch: PlayerMotion = createPlayerMotion(SPAWN_POSITION);

  constructor(options: WorldSimulationOptions) {
    this.seed = options.seed;
    this.regrowMinSeconds = options.regrowMinSeconds ?? REGROW_MIN_SECONDS;
    this.clearing = buildTestClearing(options.seed);
    const terrain = options.terrain ?? createWildernessTerrain(options.seed);
    this.wilderness = buildWilderness(options.seed, terrain);
    this.collision = createCollisionWorld(terrain, [
      ...this.clearing.colliders,
      ...this.wilderness.colliders,
    ]);
    this.standing = [...this.clearing.props];
    this.world = createWorld();

    if (options.withProps !== false) {
      for (const prop of this.clearing.props) {
        this.world.spawn(
          Position({ x: prop.x, y: 0, z: prop.z }),
          Prop({
            kindIndex: propKindIndex(prop.kind),
            rotationY: prop.rotationY,
            scale: prop.scale,
          }),
          StaticTag,
        );
      }
    }
  }

  /**
   * Let go of the ECS world.
   *
   * Koota hands out a fixed number of world ids per process, so anything that
   * builds more than one world in a row (tests, the load-test benchmark) has to
   * give them back. A Durable Object holds exactly one for its whole life.
   */
  dispose(): void {
    this.players.clear();
    this.world.destroy();
  }

  get playerCount(): number {
    return this.players.size;
  }

  hasPlayer(netId: number): boolean {
    return this.players.has(netId);
  }

  playerIds(): number[] {
    return [...this.players.keys()];
  }

  /** Put a player into the world, either fresh or restored from storage. */
  addPlayer(netId: number, saved?: PersistedPlayer): void {
    if (this.players.has(netId)) return;

    const spawn = saved ? { x: saved.x, y: saved.y, z: saved.z } : this.nextSpawnPosition();
    const facingYaw = saved?.facingYaw ?? 0;

    const entity = this.world.spawn(
      PlayerTag,
      Position({ x: spawn.x, y: spawn.y, z: spawn.z }),
      Velocity({ x: 0, y: 0, z: 0 }),
      Facing({ yaw: facingYaw }),
      Grounded({ value: true }),
      NetworkId({ value: netId }),
      LastProcessedInput({ seq: 0 }),
      AimYaw({ yaw: facingYaw }),
    );

    this.players.set(netId, {
      netId,
      entity,
      queue: [],
      inventory: saved ? inventoryFromEntries(saved.items) : createInventory(),
      swingCooldownTicks: 0,
      swingWasHeld: false,
      cast: null,
      lastProcessedSeq: 0,
      droppedInputs: 0,
    });
  }

  removePlayer(netId: number): boolean {
    const runtime = this.players.get(netId);
    if (!runtime) return false;
    runtime.entity.destroy();
    this.players.delete(netId);
    return true;
  }

  /**
   * Accept inputs from a client.
   *
   * Anything older than what we have already simulated is dropped, and a client
   * that floods us simply loses its oldest inputs instead of growing our memory.
   */
  queueInput(netId: number, input: PlayerInput): void {
    const runtime = this.players.get(netId);
    if (!runtime) return;
    if (input.seq <= runtime.lastProcessedSeq) return;

    const queued = runtime.queue;
    const newest = queued[queued.length - 1];
    if (newest !== undefined && input.seq <= newest.seq) return;

    queued.push(input);
    while (queued.length > MAX_QUEUED_INPUTS_PER_PLAYER) {
      queued.shift();
      runtime.droppedInputs += 1;
    }
  }

  queueInputs(netId: number, inputs: readonly PlayerInput[]): void {
    for (const input of inputs) this.queueInput(netId, input);
  }

  lastProcessedSeq(netId: number): number {
    return this.players.get(netId)?.lastProcessedSeq ?? 0;
  }

  droppedInputs(netId: number): number {
    return this.players.get(netId)?.droppedInputs ?? 0;
  }

  /**
   * Simulate a single 20 Hz tick.
   *
   * `nowMs` is real time, and it is here rather than read from a clock because
   * shared code must stay deterministic and because Workers freeze the clock
   * between I/O anyway. Only regrowth uses it, and only to stamp the moment a
   * tree came down.
   */
  step(nowMs: number): void {
    this.nowMs = nowMs;
    this.tick += 1;
    const scratch = this.scratch;

    this.world
      .query(PlayerTag, Position, Velocity, Facing, Grounded, NetworkId, LastProcessedInput, AimYaw)
      .updateEach(([position, velocity, facing, grounded, networkId, lastProcessed, aim]) => {
        const runtime = this.players.get(networkId.value);
        if (runtime === undefined) return;

        scratch.position.x = position.x;
        scratch.position.y = position.y;
        scratch.position.z = position.z;
        scratch.velocity.x = velocity.x;
        scratch.velocity.y = velocity.y;
        scratch.velocity.z = velocity.z;
        scratch.facingYaw = facing.yaw;
        scratch.grounded = grounded.value;

        let wantsToInteract = false;
        let wantsToSwing = false;
        let wantsToCast = false;
        let aimedYaw = aim.yaw;

        // A line in the water keeps its own time: the fish bites when it bites,
        // and wandering off brings the line in, whether or not inputs arrived.
        if (runtime.cast !== null) this.tickLine(runtime, runtime.cast, scratch.position);

        const steps = inputsToConsume(runtime.queue.length);
        if (steps === 0) {
          // No packet arrived in time: the player coasts to a stop where they are.
          stepPlayer(
            scratch,
            idleInput(runtime.lastProcessedSeq, aim.yaw),
            TICK_SECONDS,
            this.collision,
          );
        } else {
          for (let i = 0; i < steps; i++) {
            const input = runtime.queue.shift();
            if (input === undefined) break;
            stepPlayer(scratch, input, TICK_SECONDS, this.collision);
            if (isHeld(input, PlayerButton.Interact)) wantsToInteract = true;
            const swingHeld = isHeld(input, PlayerButton.Swing);
            const clicked = swingHeld && !runtime.swingWasHeld;
            runtime.swingWasHeld = swingHeld;
            if (runtime.cast !== null) {
              // With a line out, the button is for the fish and nothing else,
              // and each input is read in turn: when the click was made matters.
              this.readLine(runtime, runtime.cast, {
                seq: input.seq,
                clicked,
                sawBite: isHeld(input, PlayerButton.SawBite),
              });
            } else {
              if (swingHeld) wantsToSwing = true;
              if (clicked) wantsToCast = true;
            }
            runtime.lastProcessedSeq = input.seq;
            aim.yaw = input.yaw;
            aimedYaw = input.yaw;
          }
        }

        // Reaching and swinging are judged where the player ended up, not where
        // they started, and only the server ever decides what happens.
        if (wantsToInteract) this.tryPickup(runtime, scratch.position);

        if (runtime.swingCooldownTicks > 0) runtime.swingCooldownTicks -= 1;
        if (runtime.cast === null) {
          if (wantsToSwing) this.trySwing(runtime, scratch.position, aimedYaw);
          if (wantsToCast) this.tryCast(runtime, scratch.position, aimedYaw);
        }

        position.x = scratch.position.x;
        position.y = scratch.position.y;
        position.z = scratch.position.z;
        velocity.x = scratch.velocity.x;
        velocity.y = scratch.velocity.y;
        velocity.z = scratch.velocity.z;
        facing.yaw = scratch.facingYaw;
        grounded.value = scratch.grounded;
        lastProcessed.seq = runtime.lastProcessedSeq;
      });
  }

  /**
   * Take whatever this player is standing next to.
   *
   * Nothing happens if there is nothing in reach or their pack is already full,
   * and a pickup only ever leaves the world once however many people reach for
   * it in the same tick.
   */
  private tryPickup(runtime: PlayerRuntime, position: Readonly<Vec3>): void {
    const pickup = pickupInReach(position, this.clearing.pickups, (id) =>
      this.takenPickups.has(id),
    );
    if (pickup === null) return;
    if (addItem(runtime.inventory, pickup.item) === 0) return;

    this.takenPickups.add(pickup.id);
    this.pickupEvents.push({
      netId: runtime.netId,
      pickupId: pickup.id,
      item: pickup.item,
    });
  }

  /**
   * Swing at whatever is in front of this player.
   *
   * Nothing happens without an axe, without a tree in reach, or before the
   * cooldown is up, so holding the button down chops at a steady rhythm rather
   * than as fast as packets arrive.
   */
  private trySwing(runtime: PlayerRuntime, position: Readonly<Vec3>, aimYaw: number): void {
    if (runtime.swingCooldownTicks > 0) return;
    if (!hasItem(runtime.inventory, 'axe')) return;

    const target = this.treeInReachOf(position, aimYaw);
    if (target === null) return;

    runtime.swingCooldownTicks = SWING_COOLDOWN_TICKS;

    const state = this.treeState(target.prop.id);
    const swingsTaken = state.swingsTaken + 1;
    const swingsLeft = Math.max(0, target.rule.swingsToFell - swingsTaken);

    if (swingsLeft > 0) {
      state.swingsTaken = swingsTaken;
      this.chopEvents.push({
        netId: runtime.netId,
        treeId: target.prop.id,
        swingsLeft,
        logsGained: 0,
      });
      return;
    }

    this.fellTree(target.prop.id, this.nowMs);
    // A full pack means the wood stays on the ground. The tree still falls:
    // you did chop it down, you just cannot carry what came off it.
    const logsGained = addItem(runtime.inventory, 'log', target.rule.logs);
    this.chopEvents.push({
      netId: runtime.netId,
      treeId: target.prop.id,
      swingsLeft: 0,
      logsGained,
    });
  }

  /**
   * Cast a line, if this player has a rod and is facing water.
   *
   * A tree you could chop comes first: with an axe in the pack and a trunk in
   * reach, the click was for the tree.
   */
  private tryCast(runtime: PlayerRuntime, position: Readonly<Vec3>, aimYaw: number): void {
    if (runtime.swingCooldownTicks > 0) return;
    if (!hasItem(runtime.inventory, 'rod')) return;
    if (hasItem(runtime.inventory, 'axe') && this.treeInReachOf(position, aimYaw) !== null) return;

    const spot = castLanding(position, aimYaw, this.clearing.water);
    if (spot === null) return;

    runtime.cast = startCast(this.seed, this.castCounter++, this.tick, position, spot);
    this.fishingEvents.push({ kind: 'cast', netId: runtime.netId, x: spot.x, z: spot.z });
  }

  /** A tick of waiting at the water: the bite, the leash and giving up. */
  private tickLine(runtime: PlayerRuntime, cast: Cast, position: Readonly<Vec3>): void {
    const progress = tickCast(cast, this.tick, position);
    if (progress.bit) this.fishingEvents.push({ kind: 'bite', netId: runtime.netId });
    if (progress.end !== null) this.endCast(runtime, progress.end);
  }

  /** One of the angler's inputs: did they click, and did they see the bite? */
  private readLine(runtime: PlayerRuntime, cast: Cast, input: CastInput): void {
    const end = readCastInput(cast, this.seed, this.tick, input);
    if (end !== null) this.endCast(runtime, end);
  }

  /** The line comes in, with or without a fish, and everybody hears how. */
  private endCast(runtime: PlayerRuntime, end: CastEnd): void {
    runtime.cast = null;
    runtime.swingCooldownTicks = CAST_COOLDOWN_TICKS;

    if (end.outcome === 'caught') {
      // Hooked either way; a full pack means it goes back in the water.
      const added = addItem(runtime.inventory, end.item);
      this.fishingEvents.push({ kind: 'caught', netId: runtime.netId, item: end.item, added });
      return;
    }
    this.fishingEvents.push({ kind: end.outcome, netId: runtime.netId });
  }

  /** Take a tree out of the world: it stops blocking, and a stump blocks instead. */
  private fellTree(treeId: number, felledAtMs: number): void {
    const state = this.treeState(treeId);
    if (state.felled) return;
    state.felled = true;
    state.swingsTaken = 0;
    state.felledAtMs = felledAtMs;

    const index = this.clearing.indexById.get(treeId);
    const tree = index === undefined ? undefined : this.standing[index];
    if (index === undefined || tree === undefined) return;
    replaceCollider(this.collision, index, stumpColliderFor(tree));
  }

  /**
   * Put a tree back, at whatever size this generation of it is.
   *
   * Both the thing you bump into and the thing reach is measured against have
   * to agree it is a tree again, and agree about how big.
   */
  private growTree(treeId: number, state: TreeState): void {
    state.felled = false;
    state.swingsTaken = 0;
    state.generation = nextGeneration(state.generation);

    const index = this.clearing.indexById.get(treeId);
    const original = index === undefined ? undefined : this.clearing.props[index];
    if (index === undefined || original === undefined) return;

    const grown = treeAtGeneration(this.seed, original, state.generation);
    this.standing[index] = grown;
    replaceCollider(this.collision, index, colliderForProp(grown));
    this.regrowthEvents.push({ treeId, generation: state.generation });
  }

  private treeState(treeId: number): TreeState {
    const existing = this.trees.get(treeId);
    if (existing !== undefined) return existing;
    const fresh: TreeState = { swingsTaken: 0, felled: false, felledAtMs: 0, generation: 0 };
    this.trees.set(treeId, fresh);
    return fresh;
  }

  /**
   * Bring back every tree whose time is up and whose spot is free.
   *
   * Called with real time, because a world with nobody in it does not tick. On
   * waking, everything that fell long enough ago comes back at once.
   */
  regrowTrees(nowMs: number): TreeRegrown[] {
    const players: Vec3[] = [];
    for (const runtime of this.players.values()) {
      const position = runtime.entity.get(Position);
      if (position !== undefined) players.push({ x: position.x, y: position.y, z: position.z });
    }

    for (const [treeId, state] of this.trees) {
      if (!state.felled) continue;
      const dueAt = regrowDueAtMs(
        this.seed,
        treeId,
        state.generation,
        state.felledAtMs,
        this.regrowMinSeconds,
      );
      if (nowMs < dueAt) continue;

      const index = this.clearing.indexById.get(treeId);
      const original = index === undefined ? undefined : this.clearing.props[index];
      if (index === undefined || original === undefined) continue;

      // The same tree `growTree` is about to put here, so the room it asks for
      // is the room it will take.
      const grown = treeAtGeneration(this.seed, original, nextGeneration(state.generation));
      const footprint = colliderFootprintRadius(colliderForProp(grown));
      // Somebody is standing here: it waits rather than growing through them.
      if (!spotIsClear(grown.x, grown.z, footprint, players)) continue;

      this.growTree(treeId, state);
    }

    return this.regrowthEvents.splice(0);
  }

  /** The tree this player would hit if they swung, or null. Used by tests. */
  treeInReachOf(position: Readonly<Vec3>, aimYaw: number): ChopTarget | null {
    return treeInReach(position, aimYaw, this.standing, (id) => this.isFelled(id));
  }

  isFelled(treeId: number): boolean {
    return this.trees.get(treeId)?.felled === true;
  }

  /** How many more swings this tree needs, or null if it is already down. */
  swingsLeftOn(treeId: number): number | null {
    const state = this.trees.get(treeId);
    if (state?.felled === true) return null;
    const index = this.clearing.indexById.get(treeId);
    const tree = index === undefined ? undefined : this.standing[index];
    if (tree === undefined) return null;
    const rule = choppingRuleFor(PROP_KINDS[tree.kind]);
    if (rule === null) return null;
    return rule.swingsToFell - (state?.swingsTaken ?? 0);
  }

  /** Trees that are down right now, for sending to a client. */
  felledTreeIds(): number[] {
    const down: number[] = [];
    for (const [treeId, state] of this.trees) if (state.felled) down.push(treeId);
    return down;
  }

  /** How many times this spot has grown back. Zero for a tree nobody has touched. */
  generationOf(treeId: number): number {
    return this.trees.get(treeId)?.generation ?? 0;
  }

  /** What the client needs to draw the trees that are not as the seed left them. */
  changedTrees(): Array<{ treeId: number; generation: number; felled: boolean }> {
    const changed: Array<{ treeId: number; generation: number; felled: boolean }> = [];
    for (const [treeId, state] of this.trees) {
      if (!state.felled && state.generation === 0) continue;
      changed.push({ treeId, generation: state.generation, felled: state.felled });
    }
    return changed;
  }

  /** Everything worth saving about the trees. Untouched trees are not saved. */
  persistableTrees(): PersistedTree[] {
    const saved: PersistedTree[] = [];
    for (const [treeId, state] of this.trees) {
      if (!state.felled && state.swingsTaken === 0 && state.generation === 0) continue;
      saved.push({
        treeId,
        swingsTaken: state.swingsTaken,
        felled: state.felled,
        felledAtMs: state.felledAtMs,
        generation: state.generation,
      });
    }
    return saved;
  }

  /** Put the trees back as they were after the world wakes from storage. */
  restoreTrees(trees: Iterable<PersistedTree>): void {
    for (const tree of trees) {
      const state = this.treeState(tree.treeId);
      state.generation = tree.generation;
      state.swingsTaken = tree.swingsTaken;

      const index = this.clearing.indexById.get(tree.treeId);
      const original = index === undefined ? undefined : this.clearing.props[index];
      if (index !== undefined && original !== undefined && tree.generation > 0) {
        const grown = treeAtGeneration(this.seed, original, tree.generation);
        this.standing[index] = grown;
        replaceCollider(this.collision, index, colliderForProp(grown));
      }

      if (tree.felled) this.fellTree(tree.treeId, tree.felledAtMs);
    }
  }

  /** Hand over every swing that landed since this was last asked. */
  drainChopEvents(): TreeChopped[] {
    return this.chopEvents.splice(0);
  }

  /** Hand over everything that happened at the water since this was last asked. */
  drainFishingEvents(): FishingEvent[] {
    return this.fishingEvents.splice(0);
  }

  /** This player's line, if they have one out. Used by tests. */
  castOf(netId: number): Readonly<Cast> | null {
    return this.players.get(netId)?.cast ?? null;
  }

  /** What this player could pick up right now, or null. Used by tests. */
  reachablePickup(netId: number): PlacedPickup | null {
    const position = this.players.get(netId)?.entity.get(Position);
    if (position === undefined) return null;
    return pickupInReach(position, this.clearing.pickups, (id) => this.takenPickups.has(id));
  }

  /** What a player is carrying. The client is told this; it never decides it. */
  inventoryOf(netId: number): Inventory {
    return this.players.get(netId)?.inventory ?? {};
  }

  /** Pickups already taken, for sending to a client and for saving. */
  takenPickupIds(): number[] {
    return [...this.takenPickups];
  }

  /** Put back the set of taken pickups after the world wakes from storage. */
  restoreTakenPickups(ids: Iterable<number>): void {
    for (const id of ids) this.takenPickups.add(id);
  }

  /** Hand over everything that happened since this was last asked. */
  drainPickupEvents(): PickupTaken[] {
    return this.pickupEvents.splice(0);
  }

  /** Read one player's state, mostly for tests and for saving. */
  readPlayer(netId: number): PlayerMotion | undefined {
    const runtime = this.players.get(netId);
    if (!runtime) return undefined;
    const position = runtime.entity.get(Position);
    const velocity = runtime.entity.get(Velocity);
    const facing = runtime.entity.get(Facing);
    const grounded = runtime.entity.get(Grounded);
    if (!position || !velocity || !facing || !grounded) return undefined;
    return {
      position: { x: position.x, y: position.y, z: position.z },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      facingYaw: facing.yaw,
      grounded: grounded.value,
    };
  }

  /** Move a player directly. Used when restoring a save, never by a client. */
  placePlayer(netId: number, position: Readonly<Vec3>, facingYaw: number): void {
    const runtime = this.players.get(netId);
    if (!runtime) return;
    runtime.entity.set(Position, { x: position.x, y: position.y, z: position.z });
    runtime.entity.set(Velocity, { x: 0, y: 0, z: 0 });
    runtime.entity.set(Facing, { yaw: facingYaw });
    runtime.entity.set(AimYaw, { yaw: facingYaw });
  }

  /** Everything worth writing to storage. */
  persistablePlayers(): PersistedPlayer[] {
    const saved: PersistedPlayer[] = [];
    for (const runtime of this.players.values()) {
      const position = runtime.entity.get(Position);
      const facing = runtime.entity.get(Facing);
      if (!position || !facing) continue;
      saved.push({
        netId: runtime.netId,
        x: position.x,
        y: position.y,
        z: position.z,
        facingYaw: facing.yaw,
        items: inventoryEntries(runtime.inventory),
      });
    }
    return saved;
  }

  /**
   * The players a given viewer should be told about.
   *
   * Interest management: only entities within about 100 m are sent, so a busy
   * world does not cost every player bandwidth for people they cannot see.
   */
  snapshotFor(viewerNetId: number, into: SnapshotEntity[] = []): SnapshotEntity[] {
    into.length = 0;
    const viewer = this.players.get(viewerNetId);
    if (!viewer) return into;
    const viewerPosition = viewer.entity.get(Position);
    if (!viewerPosition) return into;
    const radiusSquared = INTEREST_RADIUS * INTEREST_RADIUS;

    this.world
      .query(PlayerTag, Position, Velocity, Facing, Grounded, NetworkId)
      .readEach(([position, velocity, facing, grounded, networkId]) => {
        if (networkId.value !== viewerNetId) {
          const dx = position.x - viewerPosition.x;
          const dz = position.z - viewerPosition.z;
          if (dx * dx + dz * dz > radiusSquared) return;
        }
        const speedSquared = velocity.x * velocity.x + velocity.z * velocity.z;
        let flags = 0;
        if (speedSquared > 0.04) flags |= SnapshotFlag.Moving;
        if (!grounded.value) flags |= SnapshotFlag.Airborne;
        if (speedSquared > SPRINT_REPORTING_SPEED * SPRINT_REPORTING_SPEED) {
          flags |= SnapshotFlag.Sprinting;
        }
        into.push({
          netId: networkId.value,
          x: position.x,
          y: position.y,
          z: position.z,
          vx: velocity.x,
          vy: velocity.y,
          vz: velocity.z,
          yaw: facing.yaw,
          flags,
        });
      });

    return into;
  }

  /** Spread arrivals around the spawn point so nobody lands inside somebody else. */
  private nextSpawnPosition(): Vec3 {
    const index = this.spawnCounter++;
    if (index === 0) return { x: SPAWN_POSITION.x, y: SPAWN_POSITION.y, z: SPAWN_POSITION.z };
    // A golden-angle spiral keeps arrivals apart without any randomness.
    const angle = index * 2.39996;
    const radius = SPAWN_RING_RADIUS * Math.sqrt(index);
    return {
      x: SPAWN_POSITION.x + Math.cos(angle) * radius,
      y: SPAWN_POSITION.y,
      z: SPAWN_POSITION.z + Math.sin(angle) * radius,
    };
  }
}

/**
 * How many inputs to simulate this tick.
 *
 * One per tick keeps the player exactly in step with the server. If a burst of
 * packets arrives late we work through a couple extra so they catch up rather
 * than drift further behind.
 */
export function inputsToConsume(queueLength: number): number {
  if (queueLength === 0) return 0;
  if (queueLength <= INPUT_BACKLOG_CATCHUP_THRESHOLD) return 1;
  return Math.min(queueLength, MAX_INPUTS_PER_TICK);
}
