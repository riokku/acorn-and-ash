import { createWorld, type Entity, type World } from 'koota';

import {
  ANIMAL_RESPAWN_SECONDS,
  HUNGER_EMPTY_AFTER_SECONDS,
  HUNGER_MAX,
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
  AnimalTag,
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
import { ANIMAL_KINDS, type AnimalKindId } from '../data/animals';
import { BUILDABLE_KINDS, type BuildableKindId } from '../data/buildables';
import { colliderFootprintRadius } from '../world/colliders';
import type { ItemId } from '../data/items';
import { replaceCollider } from '../collision/capsule';
import { horizontalDistance, type Vec3 } from '../math/vec3';
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
import { ANIMAL_DENS, type AnimalDen } from '../world/animals';
import {
  fleeDirection,
  hasReachedTarget,
  shouldFlee,
  towardDirection,
  wanderTarget,
} from './animals';
import {
  addItem,
  hasItem,
  removeItem,
  createInventory,
  inventoryEntries,
  inventoryFromEntries,
  type Inventory,
} from './inventory';
import { pickupInReach } from './pickups';
import { gatherSpotInReach } from './gathering';
import { canAfford, craft } from './crafting';
import { treeInReach, type ChopTarget } from './chopping';
import { animalInReach, type CatchCandidate } from './hunting';
import { buildSpotFor, type BuildBlocker } from './building';
import {
  CAST_COOLDOWN_TICKS,
  readCastInput,
  startCast,
  tickCast,
  type Cast,
  type CastEnd,
  type CastInput,
} from './fishing';
import { drainHunger, eat, foodToEat, hungerDrainPerSecond } from './hunger';
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
  /**
   * How long a full hunger meter takes to empty, in seconds, if nothing is
   * eaten.
   *
   * Turned right down for previews and local runs, so it can be watched
   * rather than waited out. Left alone everywhere real.
   */
  readonly hungerEmptyAfterSeconds?: number;
}

/**
 * One player or animal as it appears in a snapshot.
 *
 * `netId` is that entity's own id, from a player's `netId` or an animal's -
 * the `Animal` flag says which, and the two are never compared against each
 * other. Velocity travels too. The client that owns this player needs it to
 * re-run its own movement from the server's answer, and for everybody else -
 * player or animal - it lets the client keep a late one gliding instead of
 * freezing.
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
  /**
   * This entity is wildlife, not a player. Its id is that animal's own,
   * never a player's `netId`: the two are only ever compared within the
   * same flag, never against each other.
   */
  Animal: 1 << 3,
} as const;

/** A player's saved state, as it goes into and comes out of storage. */
export interface PersistedPlayer {
  readonly netId: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly facingYaw: number;
  readonly items: readonly { readonly item: ItemId; readonly count: number }[];
  readonly hunger: number;
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

/** An animal a swing would land on right now. */
export interface CatchTarget {
  readonly id: number;
  readonly kind: AnimalKindId;
}

/**
 * A swing landed on an animal instead of a tree.
 *
 * Only the catcher is ever told: the animal disappearing is already plain to
 * everybody else from the next snapshot, the same way a felled tree needs no
 * message of its own beyond `TreeChopped`.
 */
export interface AnimalCaught {
  readonly netId: number;
  readonly item: ItemId;
  /** How many went into the pack. Zero means there was no room. */
  readonly added: number;
}

/** Something a player has placed in the world. */
export interface BuiltProp {
  readonly id: number;
  readonly kind: BuildableKindId;
  readonly x: number;
  readonly z: number;
}

/**
 * A player placed something.
 *
 * Everybody hears about the build itself from the next `builtPropsList` -
 * the same way a felled tree needs no message of its own beyond
 * `TreeChopped` - so this is only for the builder's own pack changing.
 */
export interface BuildEvent {
  readonly netId: number;
  readonly prop: BuiltProp;
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

/**
 * Word that a player's hunger changed, for that player alone: nobody else
 * needs to know how hungry somebody is or what they just ate.
 */
export interface HungerEvent {
  readonly netId: number;
  readonly hunger: number;
  /** What was just eaten, for a HUD toast. Null when this is only the meter running down. */
  readonly ate: ItemId | null;
}

/**
 * Word that a player crafted something, for that player alone: nobody else
 * needs to know what somebody else just made.
 */
export interface CraftedEvent {
  readonly netId: number;
  readonly item: ItemId;
}

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
  /** Ticks left before this player may swing, cast or gather again. */
  swingCooldownTicks: number;
  /**
   * Whether the button was down in the last input, so a fresh press can be told
   * from one being held. Chopping is happy with a held button; a cast wants a
   * click.
   */
  swingWasHeld: boolean;
  /** Same idea as `swingWasHeld`, but for the build button: a click places one, not a hold. */
  buildWasHeld: boolean;
  /** Their line in the water, if they have one out. */
  cast: Cast | null;
  lastProcessedSeq: number;
  /** Inputs thrown away because the client was sending faster than it should. */
  droppedInputs: number;
  /** How hungry they are, from `HUNGER_MAX` (full) down to zero. */
  hunger: number;
  /**
   * The last whole number of hunger this player was actually sent, so a
   * message only goes out when it would show something different.
   */
  lastSentHunger: number;
}

/** Everything the world keeps about one wild animal, between ticks. */
interface AnimalRuntime {
  readonly id: number;
  readonly entity: Entity;
  readonly kind: AnimalKindId;
  readonly denX: number;
  readonly denZ: number;
  fleeing: boolean;
  /** Where it is ambling toward, while calm. Meaningless while fleeing. */
  targetX: number;
  targetZ: number;
  /** How many wander targets it has drawn before, so the next one is a fresh hash. */
  decisionSeq: number;
  /** Caught, and waiting out `ANIMAL_RESPAWN_SECONDS` before it is back at its den. */
  caught: boolean;
  /** When it is due back, in real time. Meaningless unless `caught`. */
  respawnAtMs: number;
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
  readonly hungerDrainPerSecond: number;

  /** How many ticks have been simulated since the world was created. */
  tick = 0;

  /** Real time as of the tick being simulated, supplied by the caller. */
  private nowMs = 0;

  private readonly players = new Map<number, PlayerRuntime>();
  private readonly animals = new Map<number, AnimalRuntime>();
  /** Pickups that somebody has already taken, by id. */
  private readonly takenPickups = new Set<number>();
  /** Drained by the world server each tick and turned into messages. */
  private readonly pickupEvents: PickupTaken[] = [];
  /** Every tree anybody has touched, by prop id. Untouched trees are not here. */
  private readonly trees = new Map<number, TreeState>();
  private readonly chopEvents: TreeChopped[] = [];
  private readonly catchEvents: AnimalCaught[] = [];
  private readonly regrowthEvents: TreeRegrown[] = [];
  private readonly fishingEvents: FishingEvent[] = [];
  /** Every cast in this world gets its own number, so no two share a roll. */
  private castCounter = 0;
  private readonly hungerEvents: HungerEvent[] = [];
  private readonly craftEvents: CraftedEvent[] = [];
  /** Who gathered a stick this tick, so the world server knows whose pack to send. */
  private readonly gatherEvents: number[] = [];
  /** Everything anybody has ever built. Nothing is ever removed from it yet. */
  private readonly builtProps: BuiltProp[] = [];
  private nextBuiltPropId = 1;
  private readonly buildEvents: BuildEvent[] = [];
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
    this.hungerDrainPerSecond = hungerDrainPerSecond(
      options.hungerEmptyAfterSeconds ?? HUNGER_EMPTY_AFTER_SECONDS,
    );
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

    for (const den of ANIMAL_DENS) {
      this.spawnAnimal(den, terrain);
    }
  }

  private spawnAnimal(den: AnimalDen, terrain: Terrain): void {
    const y = terrain.heightAt(den.x, den.z);
    const entity = this.world.spawn(
      AnimalTag,
      Position({ x: den.x, y, z: den.z }),
      Velocity({ x: 0, y: 0, z: 0 }),
      Facing({ yaw: 0 }),
      NetworkId({ value: den.id }),
    );
    this.animals.set(den.id, {
      id: den.id,
      entity,
      kind: den.kind,
      denX: den.x,
      denZ: den.z,
      fleeing: false,
      // Starting already "arrived" makes the first tick draw a real wander
      // target rather than needing a special case for a fresh spawn.
      targetX: den.x,
      targetZ: den.z,
      decisionSeq: 0,
      caught: false,
      respawnAtMs: 0,
    });
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
    this.animals.clear();
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

    const hunger = saved?.hunger ?? HUNGER_MAX;
    this.players.set(netId, {
      netId,
      entity,
      queue: [],
      inventory: saved ? inventoryFromEntries(saved.items) : createInventory(),
      swingCooldownTicks: 0,
      swingWasHeld: false,
      buildWasHeld: false,
      cast: null,
      lastProcessedSeq: 0,
      droppedInputs: 0,
      hunger,
      // Matches what `addPlayer`'s caller is about to be told separately, on
      // arrival, so the tick loop does not repeat itself the moment it runs.
      lastSentHunger: Math.round(hunger),
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

        runtime.hunger = drainHunger(runtime.hunger, TICK_SECONDS, this.hungerDrainPerSecond);

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
        let wantsToBuild = false;
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
            const buildHeld = isHeld(input, PlayerButton.Build);
            const buildClicked = buildHeld && !runtime.buildWasHeld;
            runtime.buildWasHeld = buildHeld;
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
              if (buildClicked) wantsToBuild = true;
            }
            runtime.lastProcessedSeq = input.seq;
            aim.yaw = input.yaw;
            aimedYaw = input.yaw;
          }
        }

        // Reaching and swinging are judged where the player ended up, not where
        // they started, and only the server ever decides what happens.
        if (wantsToInteract) {
          // The same button reaches for what is at your feet first, then for
          // a patch of sticks, and only failing both reaches into your own
          // pack instead.
          const pickedUp = this.tryPickup(runtime, scratch.position);
          if (!pickedUp) {
            const gathered = this.tryGather(runtime, scratch.position);
            if (!gathered) this.tryEat(runtime);
          }
        }

        if (runtime.swingCooldownTicks > 0) runtime.swingCooldownTicks -= 1;
        if (runtime.cast === null) {
          if (wantsToSwing) this.trySwing(runtime, scratch.position, aimedYaw);
          if (wantsToCast) this.tryCast(runtime, scratch.position, aimedYaw);
          if (wantsToBuild) this.tryBuild(runtime, scratch.position, aimedYaw);
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

        // Catches the meter crossing a whole point on its own, if eating did
        // not already say something this tick.
        this.queueHungerEvent(runtime, null);
      });

    this.stepAnimals();
  }

  /** Amble, bolt from the nearest player, or wait out a catch - whichever this tick calls for. */
  private stepAnimals(): void {
    this.world
      .query(AnimalTag, Position, Velocity, Facing, NetworkId)
      .updateEach(([position, velocity, facing, networkId]) => {
        const runtime = this.animals.get(networkId.value);
        if (runtime === undefined) return;

        if (runtime.caught) {
          if (this.nowMs < runtime.respawnAtMs) {
            velocity.x = 0;
            velocity.z = 0;
            return;
          }
          // Time is up: back at the den, as if it had never left.
          runtime.caught = false;
          runtime.fleeing = false;
          runtime.targetX = runtime.denX;
          runtime.targetZ = runtime.denZ;
          position.x = runtime.denX;
          position.z = runtime.denZ;
          position.y = this.collision.terrain.heightAt(runtime.denX, runtime.denZ);
          velocity.x = 0;
          velocity.z = 0;
          return;
        }

        const kind = ANIMAL_KINDS[runtime.kind];

        const nearestPlayer = this.nearestPlayerPosition(position);
        const nearestDistance =
          nearestPlayer === null ? Infinity : horizontalDistance(position, nearestPlayer);
        runtime.fleeing = shouldFlee(runtime.fleeing, nearestDistance, kind);

        let direction: { x: number; z: number };
        let speed: number;
        if (runtime.fleeing && nearestPlayer !== null) {
          direction = fleeDirection(position.x, position.z, nearestPlayer.x, nearestPlayer.z);
          speed = kind.fleeSpeed;
        } else {
          if (hasReachedTarget(position.x, position.z, runtime.targetX, runtime.targetZ)) {
            runtime.decisionSeq += 1;
            const next = wanderTarget(
              this.seed,
              runtime.id,
              runtime.decisionSeq,
              runtime.denX,
              runtime.denZ,
              kind.leashRadius,
            );
            runtime.targetX = next.x;
            runtime.targetZ = next.z;
          }
          direction = towardDirection(position.x, position.z, runtime.targetX, runtime.targetZ);
          speed = kind.wanderSpeed;
        }

        velocity.x = direction.x * speed;
        velocity.z = direction.z * speed;
        position.x += velocity.x * TICK_SECONDS;
        position.z += velocity.z * TICK_SECONDS;
        position.y = this.collision.terrain.heightAt(position.x, position.z);
        // Standing still keeps whichever way it was last facing, rather than
        // snapping to face the den the instant it stops.
        if (speed > 0) facing.yaw = Math.atan2(-direction.x, -direction.z);
      });
  }

  /** The nearest connected player to a point, or null in an empty world. */
  private nearestPlayerPosition(from: Readonly<Vec3>): Vec3 | null {
    let best: Vec3 | null = null;
    let bestDistance = Infinity;
    for (const runtime of this.players.values()) {
      const position = runtime.entity.get(Position);
      if (position === undefined) continue;
      const distance = horizontalDistance(from, position);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = position;
      }
    }
    return best;
  }

  /**
   * Take whatever this player is standing next to.
   *
   * Nothing happens if there is nothing in reach or their pack is already full,
   * and a pickup only ever leaves the world once however many people reach for
   * it in the same tick. Returns whether it happened, so the caller can fall
   * back to something else the same button might mean.
   */
  private tryPickup(runtime: PlayerRuntime, position: Readonly<Vec3>): boolean {
    const pickup = pickupInReach(position, this.clearing.pickups, (id) =>
      this.takenPickups.has(id),
    );
    if (pickup === null) return false;
    if (addItem(runtime.inventory, pickup.item) === 0) return false;

    this.takenPickups.add(pickup.id);
    this.pickupEvents.push({
      netId: runtime.netId,
      pickupId: pickup.id,
      item: pickup.item,
    });
    return true;
  }

  /**
   * Gather a stick from a nearby patch of fallen branches, if there is one in
   * reach and this player is not still catching their breath from a swing, a
   * cast or a gather of their own. Unlike a pickup the patch is never used
   * up - only how often any one player may draw from it. Returns whether it
   * happened.
   */
  private tryGather(runtime: PlayerRuntime, position: Readonly<Vec3>): boolean {
    if (runtime.swingCooldownTicks > 0) return false;
    const spot = gatherSpotInReach(position, this.clearing.gatherSpots);
    if (spot === null) return false;
    if (addItem(runtime.inventory, 'stick') === 0) return false;

    runtime.swingCooldownTicks = SWING_COOLDOWN_TICKS;
    this.gatherEvents.push(runtime.netId);
    return true;
  }

  /** Eat something out of the pack, if there is any food in it that would actually help. */
  private tryEat(runtime: PlayerRuntime): void {
    const item = foodToEat(runtime.inventory, runtime.hunger);
    if (item === null) return;

    removeItem(runtime.inventory, item);
    runtime.hunger = eat(runtime.hunger, item);
    this.queueHungerEvent(runtime, item);
  }

  /**
   * Tell this player their hunger, but only when it is worth a message: right
   * after eating, or once the passing seconds have moved it by a whole point.
   */
  private queueHungerEvent(runtime: PlayerRuntime, ate: ItemId | null): void {
    const rounded = Math.round(runtime.hunger);
    if (ate === null && rounded === runtime.lastSentHunger) return;
    runtime.lastSentHunger = rounded;
    this.hungerEvents.push({ netId: runtime.netId, hunger: rounded, ate });
  }

  /**
   * Swing at whatever is in front of this player.
   *
   * Nothing happens without an axe, without a tree or an animal in reach, or
   * before the cooldown is up, so holding the button down chops at a steady
   * rhythm rather than as fast as packets arrive. A tree in reach always
   * wins over an animal behind it, the same way a tree already wins over a
   * cast in `tryCast`.
   */
  private trySwing(runtime: PlayerRuntime, position: Readonly<Vec3>, aimYaw: number): void {
    if (runtime.swingCooldownTicks > 0) return;
    if (!hasItem(runtime.inventory, 'axe')) return;

    const target = this.treeInReachOf(position, aimYaw);
    if (target !== null) {
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
      return;
    }

    const animalTarget = this.animalInReachOf(position, aimYaw);
    if (animalTarget === null) return;

    runtime.swingCooldownTicks = SWING_COOLDOWN_TICKS;
    this.catchAnimal(runtime, animalTarget.id);
  }

  /**
   * Catch an animal that is not a tree: the swing that just missed a trunk
   * lands on whatever wildlife was in reach instead.
   *
   * It goes back to its den once `ANIMAL_RESPAWN_SECONDS` is up, the same
   * way a tree waits out `regrowMinSeconds` before it is worth chopping
   * again.
   */
  private catchAnimal(runtime: PlayerRuntime, animalId: number): void {
    const animal = this.animals.get(animalId);
    if (animal === undefined) return;

    animal.caught = true;
    animal.respawnAtMs = this.nowMs + ANIMAL_RESPAWN_SECONDS * 1000;

    const item = ANIMAL_KINDS[animal.kind].catchItem;
    // A full pack means it was still caught - the den stays empty for the
    // same reason a felled tree still falls with no room for the logs.
    const added = addItem(runtime.inventory, item, 1);
    this.catchEvents.push({ netId: runtime.netId, item, added });
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

  /**
   * Place a campfire in front of this player, if they can afford one and
   * there is a clear spot for it.
   *
   * Only one kind exists yet, so there is nothing to choose between - once a
   * second one does, this is where picking one comes in.
   */
  private tryBuild(runtime: PlayerRuntime, position: Readonly<Vec3>, aimYaw: number): void {
    if (runtime.swingCooldownTicks > 0) return;
    const buildable = BUILDABLE_KINDS.campfire;
    if (!canAfford(runtime.inventory, buildable)) return;

    const blockers: BuildBlocker[] = [
      ...this.standing.map((prop) => ({
        x: prop.x,
        z: prop.z,
        footprintRadius: PROP_KINDS[prop.kind].colliderRadius * prop.scale,
      })),
      ...this.builtProps.map((built) => ({
        x: built.x,
        z: built.z,
        footprintRadius: BUILDABLE_KINDS[built.kind].footprintRadius,
      })),
    ];
    const spot = buildSpotFor(
      position,
      aimYaw,
      buildable.footprintRadius,
      this.clearing.water,
      blockers,
    );
    if (spot === null) return;

    runtime.swingCooldownTicks = SWING_COOLDOWN_TICKS;
    for (const cost of buildable.costs) removeItem(runtime.inventory, cost.item, cost.amount);

    const prop: BuiltProp = { id: this.nextBuiltPropId++, kind: 'campfire', x: spot.x, z: spot.z };
    this.builtProps.push(prop);
    this.buildEvents.push({ netId: runtime.netId, prop });
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

  /** The animal this player would catch if they swung, or null. Used by tests. */
  animalInReachOf(position: Readonly<Vec3>, aimYaw: number): CatchTarget | null {
    const candidates: CatchCandidate[] = [];
    for (const runtime of this.animals.values()) {
      if (runtime.caught) continue;
      const animalPosition = runtime.entity.get(Position);
      if (animalPosition === undefined) continue;
      candidates.push({ id: runtime.id, x: animalPosition.x, z: animalPosition.z });
    }

    const found = animalInReach(position, aimYaw, candidates);
    const runtime = found === null ? undefined : this.animals.get(found.id);
    return runtime === undefined ? null : { id: runtime.id, kind: runtime.kind };
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

  /** Everything anybody has ever built, for sending to a client or saving to storage. */
  builtPropsList(): readonly BuiltProp[] {
    return [...this.builtProps];
  }

  /** Put built props back as they were after the world wakes from storage. */
  restoreBuiltProps(props: Iterable<BuiltProp>): void {
    for (const prop of props) {
      this.builtProps.push(prop);
      this.nextBuiltPropId = Math.max(this.nextBuiltPropId, prop.id + 1);
    }
  }

  /** Hand over every build placed since this was last asked. */
  drainBuildEvents(): BuildEvent[] {
    return this.buildEvents.splice(0);
  }

  /** Hand over every swing that landed since this was last asked. */
  drainChopEvents(): TreeChopped[] {
    return this.chopEvents.splice(0);
  }

  /** Hand over every animal caught since this was last asked. */
  drainCatchEvents(): AnimalCaught[] {
    return this.catchEvents.splice(0);
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

  /** How hungry a player is right now, from `HUNGER_MAX` down to zero. */
  hungerOf(netId: number): number {
    return Math.round(this.players.get(netId)?.hunger ?? HUNGER_MAX);
  }

  /** Hand over every change to anybody's hunger since this was last asked. */
  drainHungerEvents(): HungerEvent[] {
    return this.hungerEvents.splice(0);
  }

  /**
   * Make something out of whatever this player is carrying, if there is a
   * recipe for it, they can afford it and have room for the result.
   *
   * Crafting is not tied to reach or facing the way chopping and picking
   * things up are, so unlike those it does not wait for the next tick: a
   * client's request is settled the moment it arrives. Returns whether
   * anything was actually made.
   */
  craftItem(netId: number, item: ItemId): boolean {
    const runtime = this.players.get(netId);
    if (runtime === undefined) return false;
    if (!craft(runtime.inventory, item)) return false;

    this.craftEvents.push({ netId, item });
    return true;
  }

  /** Hand over every craft since this was last asked. */
  drainCraftEvents(): CraftedEvent[] {
    return this.craftEvents.splice(0);
  }

  /** Who gathered a stick since this was last asked, so their pack can be sent. */
  drainGatherEvents(): number[] {
    return this.gatherEvents.splice(0);
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
        hunger: runtime.hunger,
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

    this.world
      .query(AnimalTag, Position, Velocity, Facing, NetworkId)
      .readEach(([position, velocity, facing, networkId]) => {
        // A caught animal is gone until it respawns: left out of every
        // viewer's snapshot entirely, the same as a pickup nobody can see
        // once it is taken.
        if (this.animals.get(networkId.value)?.caught === true) return;

        const dx = position.x - viewerPosition.x;
        const dz = position.z - viewerPosition.z;
        if (dx * dx + dz * dz > radiusSquared) return;

        const speedSquared = velocity.x * velocity.x + velocity.z * velocity.z;
        into.push({
          netId: networkId.value,
          x: position.x,
          y: position.y,
          z: position.z,
          vx: velocity.x,
          vy: velocity.y,
          vz: velocity.z,
          yaw: facing.yaw,
          flags: SnapshotFlag.Animal | (speedSquared > 0.04 ? SnapshotFlag.Moving : 0),
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
