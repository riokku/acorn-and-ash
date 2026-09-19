import { createWorld, type Entity, type World } from 'koota';

import {
  INPUT_BACKLOG_CATCHUP_THRESHOLD,
  INTEREST_RADIUS,
  MAX_INPUTS_PER_TICK,
  MAX_QUEUED_INPUTS_PER_PLAYER,
  SPAWN_POSITION,
  SPAWN_RING_RADIUS,
  SPRINT_REPORTING_SPEED,
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
import { propKindIndex } from '../data/props';
import type { ItemId } from '../data/items';
import type { Vec3 } from '../math/vec3';
import { buildTestClearing, type Clearing, type PlacedPickup } from '../world/clearing';
import { createFlatTerrain, type Terrain } from '../world/terrain';
import {
  addItem,
  createInventory,
  inventoryEntries,
  inventoryFromEntries,
  type Inventory,
} from './inventory';
import { pickupInReach } from './pickups';
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
  /** Defaults to the flat Phase 0 terrain. */
  readonly terrain?: Terrain;
  /** Skip spawning scenery entities. Only used by benchmarks. */
  readonly withProps?: boolean;
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

interface PlayerRuntime {
  readonly netId: number;
  readonly entity: Entity;
  readonly queue: PlayerInput[];
  readonly inventory: Inventory;
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
  readonly collision: CollisionWorld;

  /** How many ticks have been simulated since the world was created. */
  tick = 0;

  private readonly players = new Map<number, PlayerRuntime>();
  /** Pickups that somebody has already taken, by id. */
  private readonly takenPickups = new Set<number>();
  /** Drained by the world server each tick and turned into messages. */
  private readonly pickupEvents: PickupTaken[] = [];
  private spawnCounter = 0;
  /** Reused every tick so a busy world does not allocate per player. */
  private readonly scratch: PlayerMotion = createPlayerMotion(SPAWN_POSITION);

  constructor(options: WorldSimulationOptions) {
    this.seed = options.seed;
    this.clearing = buildTestClearing(options.seed);
    const terrain = options.terrain ?? createFlatTerrain(0);
    this.collision = createCollisionWorld(terrain, this.clearing.colliders);
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

  /** Simulate a single 20 Hz tick. */
  step(): void {
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
            runtime.lastProcessedSeq = input.seq;
            aim.yaw = input.yaw;
          }
        }

        // Reaching for something is judged where the player ended up, not where
        // they started, and only the server ever decides who got it.
        if (wantsToInteract) this.tryPickup(runtime, scratch.position);

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
