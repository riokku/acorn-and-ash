/**
 * Skeleton raids (see decision 0063).
 *
 * Every so often, while a player is out in the world - twice as often at
 * night - a band of one to three skeletons turns up a little way off and
 * comes for them. They fight with the player's own moves, through the very
 * same `advanceAction` and `stepPlayer` a player's inputs go through: a
 * light combo, opened with a wind-up so it is plain to see coming, a charged
 * strike, and the dodge roll. What drives them is a small brain here that
 * makes up the inputs a player would have sent.
 *
 * A group fights the way a good action game's enemies do: only one of them
 * attacks a given player at a time, and the rest circle at a distance,
 * waiting their turn. Going indoors is the only safe place: they wait
 * outside the door for a while, then give up and leave. Each one beaten
 * leaves a bone behind.
 *
 * Deterministic, like everything shared: every roll of the dice comes from
 * the world's seed.
 */

import type { Entity, World } from 'koota';

import {
  CHOP_FACING_COSINE,
  LAG_COMPENSATION_TICKS,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SPRINT_SPEED,
  PLAYER_TURN_RATE,
  PLAYER_WALK_SPEED,
  TICK_HZ,
  TICK_SECONDS,
} from '../constants';
import { resolveCapsule, type CollisionWorld } from '../collision/capsule';
import { DODGE } from '../data/moves';
import type { ItemId } from '../data/items';
import {
  RAID,
  RAIDER_BLOW_WEIGHT,
  RAIDER_KINDS,
  RAIDER_KIND_ORDER,
  type RaiderKind,
  type RaiderKindId,
} from '../data/raiders';
import { Facing, Grounded, NetworkId, Position, RaiderTag, Velocity } from '../ecs/traits';
import { TAU, angleDelta, rotateToward } from '../math/angles';
import type { Vec3 } from '../math/vec3';
import { createRng, hashSeed, type Rng } from '../rng';
import { overlapsWater, type WaterCircle } from '../world/water';
import {
  ActionKind,
  RiseFrom,
  advanceAction,
  beginAction,
  createActionState,
  footedInput,
  stepDodge,
  type ActionContext,
  type ActionState,
  type Impact,
} from './actions';
import { animalInReach, type CatchCandidate } from './hunting';
import {
  PlayerButton,
  createPlayerMotion,
  stepPlayer,
  type PlayerInput,
  type PlayerMotion,
} from './player';

/**
 * Raider ids, well clear of every player's and animal's. They are only
 * ever compared against each other (the snapshot's `Raider` flag says
 * which an id is), but a range of their own keeps a log readable.
 */
export const RAIDER_ID_FIRST = 20000;
export const RAIDER_ID_LAST = 60000;

/** What a raid just did, for everybody to hear about (see `RaidDirector.drainNews`). */
export type RaidNewsKind = 'incoming' | 'foughtOff' | 'gaveUp';

export interface RaidNews {
  readonly kind: RaidNewsKind;
  readonly raidId: number;
  /** Whom it came for. */
  readonly targetNetId: number;
  /** How many raiders: all of them as they arrive, then how many were beaten. */
  readonly count: number;
  /** Where it is: where they turned up, or where they were when it ended. */
  readonly x: number;
  readonly z: number;
}

/** A player's blow landed on a raider, or it rolled clear of one. Told to everybody nearby. */
export interface RaiderHit {
  readonly raiderId: number;
  /** Blows still needed to beat it. Zero means it is beaten. */
  readonly hitsLeft: number;
  /** Whose blow it was, so their own browser, which already showed it, does not show it twice. */
  readonly netId: number | null;
  /** The combo's finisher or a charged strike: knocked back harder. */
  readonly heavy: boolean;
  /** A steadfast raider took the blow without being stopped (see `RaiderKind.steadfast`). */
  readonly shrugged: boolean;
}

/** One raider, the way the list every browser keeps describes it. */
export interface RaiderView {
  readonly id: number;
  readonly kind: RaiderKindId;
  readonly hitsLeft: number;
}

/** A player, as far as a raid is concerned. */
export interface RaidFighter {
  readonly netId: number;
  /** Meaningless indoors, where it is a room's own coordinates. */
  readonly position: Readonly<Vec3>;
  readonly aimYaw: number;
  readonly action: Readonly<ActionState>;
  /** Out in the world rather than inside a home. */
  readonly outdoors: boolean;
  /** Knocked out, or getting back up from it. */
  readonly down: boolean;
}

/** What a raid needs from the world it is in. */
export interface RaidHost {
  readonly collision: CollisionWorld;
  readonly water: readonly WaterCircle[];
  /** Every player in the world right now. */
  fighters(): readonly RaidFighter[];
  /**
   * A raider's blow landing on a player. `impactTick` is when it landed,
   * which may be a moment ago (see `BLOW_SETTLE_TICKS`): a dodge begun in
   * time for that moment still counts.
   */
  strikePlayer(netId: number, damage: number, impactTick: number): void;
  /** Leave something on the ground where a raider fell. */
  dropLoot(item: ItemId, count: number, position: Readonly<Vec3>, facingYaw: number): void;
}

export interface RaidOptions {
  /**
   * The shortest time outdoors between raids, in seconds of daytime. Raids
   * come somewhere between this and one and a half times it. Turned down
   * for previews, so one can be waited for rather than waited out.
   */
  readonly intervalMinSeconds?: number;
}

/**
 * How long a raider's blow takes to settle on a player after it lands: the
 * same allowance a player's own swing gets for showing things slightly in
 * the past (see decision 0056). The player sees every raider about this far
 * behind, so a roll begun the moment they see the blow coming still makes
 * it - and a step out of reach in that time does too.
 */
export const BLOW_SETTLE_TICKS = LAG_COMPENSATION_TICKS;

/** How much further than its reach a blow may still find a player who moved after it landed. */
const BLOW_SETTLE_SLACK = 1;

/** How many ticks of a raider's path a player's blow can look back over. */
const RAIDER_TRAIL_TICKS = LAG_COMPENSATION_TICKS + 1;

/** How far a player's swing has to be from a raider for it to notice and think of rolling clear. */
const DODGE_NOTICE_RADIUS = 3.6;

/** How fast a raider's aim follows its target, in radians a second, by what it is doing. */
const AIM_TRACKING = { windup: 4, charge: 3, swing: 1.4 } as const;

/**
 * How long a raider stays steady after being staggered, in ticks: a light
 * swing in that time still counts, but does not stop it again. Without it,
 * a player who simply kept clicking would hold any raider in a flinch
 * forever. The combo's heavy finisher and a charged strike always stagger.
 */
const POISE_TICKS = 24;

/** How hard a blow knocks a raider back, in metres a second. */
const KNOCKBACK = { swing: 4.5, heavy: 6, strike: 9 } as const;

/** How a raider is going about the fight right now. */
type RaiderMode =
  /** Walking in from where it turned up. */
  | 'march'
  /** Close by, waiting its turn to attack. */
  | 'circle'
  /** Its turn: closing in and attacking. */
  | 'attack'
  /** Just finished an attack, or was hit: a moment before circling again. */
  | 'recover'
  /** Nobody to fight: the player it came for is indoors. */
  | 'wait'
  /** Giving up and walking off. */
  | 'leave'
  /** Beaten, falling apart. */
  | 'down';

interface RaiderRuntime {
  readonly id: number;
  readonly kind: RaiderKindId;
  readonly raidId: number;
  readonly entity: Entity;
  readonly motion: PlayerMotion;
  readonly action: ActionState;
  readonly rng: Rng;
  previousButtons: number;
  aimYaw: number;
  /** Blows taken, weighted (see `RAIDER_BLOW_WEIGHT`). */
  damageTaken: number;
  mode: RaiderMode;
  /** Ticks since `mode` last changed. */
  modeTicks: number;
  /** Whom it is fighting right now, or null. */
  targetNetId: number | null;
  /** This attack's plan: a charged strike, or a combo this many swings long. */
  plannedStrike: boolean;
  plannedSwings: number;
  /** Whether this attack has actually begun. */
  attackBegun: boolean;
  /** When it last had a turn to attack (or turned up), so the one kept waiting longest goes next. */
  lastTurnTick: number;
  /** Circling: which way round (1 or -1), and for how much longer before thinking again. */
  circleDirection: number;
  circleTicks: number;
  /** Standing still, sizing the player up, for this many ticks. */
  pauseTicks: number;
  /** How far from the player it likes to circle: the standoff, give or take. */
  readonly standoffOffset: number;
  /** Going round something it got stuck on: which way, and for how much longer. */
  detourX: number;
  detourZ: number;
  detourTicks: number;
  stuckTicks: number;
  /** The tick a swing it last thought about dodging began on, so each swing is thought about once. */
  noticedSwingTick: number;
  /** When to roll clear of a swing it decided to dodge, and which way; -1 for none. */
  dodgeAtTick: number;
  dodgeX: number;
  dodgeZ: number;
  /** Whether to roll out of the flinch it is in, once its feet are back. */
  breakOutOfFlinch: boolean;
  /** The tick it was last staggered, for its poise (see `POISE_TICKS`). */
  staggeredAtTick: number;
  /** Where it has been, for a player's blow to look back over (see `raiderInReachOf`). */
  readonly trailX: Float32Array;
  readonly trailZ: Float32Array;
  trailHead: number;
  trailCount: number;
}

interface Raid {
  readonly id: number;
  readonly targetNetId: number;
  readonly raiderIds: number[];
  readonly size: number;
  readonly startedAtTick: number;
  beaten: number;
  /** Ticks the player it came for has been indoors. */
  waitingTicks: number;
  /** Ticks the player it came for has been too far away. */
  lostTicks: number;
  leaving: boolean;
  /** Where the player it came for was last seen outdoors: where a raid waits for them. */
  lastSeenX: number;
  lastSeenZ: number;
}

/** Whose turn it is to attack one player, and when the next may start. */
interface Turn {
  raiderId: number | null;
  freeAtTick: number;
}

interface PendingBlow {
  readonly targetNetId: number;
  readonly damage: number;
  readonly impactTick: number;
  readonly x: number;
  readonly z: number;
}

const ATTACKING_KINDS: ReadonlySet<ActionKind> = new Set([
  ActionKind.Windup,
  ActionKind.Swing,
  ActionKind.Charge,
  ActionKind.Strike,
]);

const RAIDER_CONTEXT: ActionContext = { canAttack: true, castInstead: false };

/**
 * Runs every raid in one world: when they come, where from, and every
 * raider's every move. `WorldSimulation` owns one and steps it once a tick,
 * after the players have moved.
 */
export class RaidDirector {
  private readonly raiders = new Map<number, RaiderRuntime>();
  private readonly raids = new Map<number, Raid>();
  /** Seconds of daytime left before each player's next raid, by network id. */
  private readonly countdowns = new Map<number, number>();
  private readonly turns = new Map<number, Turn>();
  private readonly pendingBlows: PendingBlow[] = [];
  private readonly news: RaidNews[] = [];
  private readonly hits: RaiderHit[] = [];
  private readonly fighterById = new Map<number, RaidFighter>();
  private readonly intervalMinSeconds: number;
  private nextRaiderId = RAIDER_ID_FIRST;
  private nextRaidId = 1;
  private draws = 0;
  private listChanged = false;
  private tick = 0;

  constructor(
    private readonly world: World,
    private readonly seed: number,
    private readonly host: RaidHost,
    options: RaidOptions = {},
  ) {
    this.intervalMinSeconds = options.intervalMinSeconds ?? RAID.intervalSeconds.min;
  }

  /** How many raiders are out in the world right now. */
  get raiderCount(): number {
    return this.raiders.size;
  }

  /** One tick of every raid, and of the countdown to the next. */
  step(tick: number, night: boolean): void {
    this.tick = tick;
    this.fighterById.clear();
    for (const fighter of this.host.fighters()) this.fighterById.set(fighter.netId, fighter);

    this.countDown(night);
    for (const raid of this.raids.values()) this.updateRaid(raid);
    for (const raider of [...this.raiders.values()]) this.stepRaider(raider);
    this.settleBlows();
  }

  /**
   * Send a raid at a player right now, whatever their countdown says: these
   * kinds, or a group drawn at random - bigger at night. Returns its id, or
   * null if there was nowhere for it to turn up. Used by tests, and by
   * `step` once a countdown runs out.
   */
  startRaid(targetNetId: number, kinds?: readonly RaiderKindId[], night = false): number | null {
    const target = this.fighterById.get(targetNetId) ?? this.findFighter(targetNetId);
    if (target === undefined || !target.outdoors) return null;
    const rng = this.nextRng('raid');
    const lineup = kinds ?? drawLineup(rng, drawGroupSize(rng, night));
    const centre = this.spawnCentre(target.position, rng);
    if (centre === null) return null;

    const raid: Raid = {
      id: this.nextRaidId++,
      targetNetId,
      raiderIds: [],
      size: lineup.length,
      startedAtTick: this.tick,
      beaten: 0,
      waitingTicks: 0,
      lostTicks: 0,
      leaving: false,
      lastSeenX: target.position.x,
      lastSeenZ: target.position.z,
    };
    // Stood in a shallow arc, side by side, facing the player.
    const towardX = target.position.x - centre.x;
    const towardZ = target.position.z - centre.z;
    const length = Math.hypot(towardX, towardZ) || 1;
    const sideX = -towardZ / length;
    const sideZ = towardX / length;
    for (let index = 0; index < lineup.length; index++) {
      const kind = lineup[index];
      if (kind === undefined) continue;
      const across = (index - (lineup.length - 1) / 2) * RAID.groupSpacing;
      const back = Math.abs(across) * 0.4;
      const spot = {
        x: centre.x + sideX * across - (towardX / length) * back,
        y: 0,
        z: centre.z + sideZ * across - (towardZ / length) * back,
      };
      const raider = this.spawnRaider(kind, raid.id, spot, Math.atan2(-towardX, -towardZ));
      raid.raiderIds.push(raider.id);
    }
    this.raids.set(raid.id, raid);
    this.countdowns.delete(targetNetId);
    this.news.push({
      kind: 'incoming',
      raidId: raid.id,
      targetNetId,
      count: raid.raiderIds.length,
      x: centre.x,
      z: centre.z,
    });
    return raid.id;
  }

  /** A player left the world: forget their countdown and anything aimed at them. */
  forgetPlayer(netId: number): void {
    this.countdowns.delete(netId);
    this.turns.delete(netId);
    this.fighterById.delete(netId);
  }

  /**
   * A player's blow, landing at `position` aimed along `aimYaw`: on the
   * raider in front of them, if there is one. Looks back `ticksBack` ticks
   * along each raider's path, for what the player saw a moment ago. Returns
   * whether a raider took it - landed, shrugged off or rolled clear of - so
   * nothing else behind it is hit as well.
   */
  blowLands(
    attackerNetId: number,
    position: Readonly<Vec3>,
    aimYaw: number,
    impact: Impact,
    ticksBack: number,
  ): boolean {
    const raiderId = this.raiderInReachOf(position, aimYaw, ticksBack);
    const raider = raiderId === null ? undefined : this.raiders.get(raiderId);
    if (raider === undefined) return false;
    const kind: RaiderKind = RAIDER_KINDS[raider.kind];

    // Mid-roll it is simply not there - unless the roll only began a moment
    // ago, too late for the player to have seen it yet: then the blow
    // catches it as it goes, the same allowance for seeing things slightly
    // in the past that lets a blow look back along its path.
    if (
      raider.action.kind === ActionKind.Dodge &&
      raider.action.age >= LAG_COMPENSATION_TICKS &&
      raider.action.age < DODGE.invulnerable
    ) {
      return true;
    }

    const weight =
      impact.kind === 'strike'
        ? RAIDER_BLOW_WEIGHT.strike
        : impact.step === 3
          ? RAIDER_BLOW_WEIGHT.finisher
          : RAIDER_BLOW_WEIGHT.swing;
    raider.damageTaken += weight;
    const hitsLeft = Math.max(0, kind.toughness - raider.damageTaken);
    const heavy = weight > RAIDER_BLOW_WEIGHT.swing;

    // Knocked back, away from whoever hit it.
    const awayX = raider.motion.position.x - position.x;
    const awayZ = raider.motion.position.z - position.z;
    const away = Math.hypot(awayX, awayZ) || 1;
    const shove =
      impact.kind === 'strike' ? KNOCKBACK.strike : heavy ? KNOCKBACK.heavy : KNOCKBACK.swing;

    // A steadfast raider shrugs off a light swing mid-attack, and any
    // raider shrugs off one that comes too soon after the last stagger.
    const steady =
      (kind.steadfast && ATTACKING_KINDS.has(raider.action.kind)) ||
      this.tick - raider.staggeredAtTick < POISE_TICKS;
    const shrugged = hitsLeft > 0 && impact.kind !== 'strike' && !heavy && steady;
    const steadfastBlock =
      hitsLeft > 0 &&
      kind.steadfast &&
      impact.kind !== 'strike' &&
      ATTACKING_KINDS.has(raider.action.kind);

    if (!shrugged && !steadfastBlock) {
      raider.motion.velocity.x = (awayX / away) * shove;
      raider.motion.velocity.z = (awayZ / away) * shove;
      // Turned to face whoever hit it.
      raider.aimYaw = Math.atan2(awayX, awayZ);
    }

    if (hitsLeft === 0) {
      this.defeat(raider);
    } else if (raider.mode === 'leave') {
      // Already giving up: staggered, but it keeps on going.
      if (!shrugged) {
        raider.staggeredAtTick = this.tick;
        beginAction(raider.action, ActionKind.Flinch);
      }
    } else if (!shrugged && !steadfastBlock) {
      raider.staggeredAtTick = this.tick;
      beginAction(raider.action, ActionKind.Flinch);
      this.releaseTurn(raider);
      raider.breakOutOfFlinch = raider.rng.nextFloat() < kind.dodgeChance * 0.6;
      this.setMode(raider, 'recover');
      raider.pauseTicks = 0;
      // Whoever hit it has its attention now.
      const attacker = this.fighterById.get(attackerNetId);
      if (attacker !== undefined && isFightable(attacker)) raider.targetNetId = attackerNetId;
    }

    this.hits.push({
      raiderId: raider.id,
      hitsLeft,
      netId: attackerNetId,
      heavy,
      shrugged: shrugged || steadfastBlock,
    });
    this.listChanged = true;
    return true;
  }

  /** The raider a blow from here, aimed this way, would land on - looking back `ticksBack` ticks. */
  raiderInReachOf(position: Readonly<Vec3>, aimYaw: number, ticksBack = 0): number | null {
    const candidates: CatchCandidate[] = [];
    for (const raider of this.raiders.values()) {
      if (raider.mode === 'down') continue;
      candidates.push({ id: raider.id, x: raider.motion.position.x, z: raider.motion.position.z });
      const back = Math.min(ticksBack, RAIDER_TRAIL_TICKS - 1, raider.trailCount - 1);
      for (let i = 1; i <= back; i++) {
        const index = (raider.trailHead - i + RAIDER_TRAIL_TICKS) % RAIDER_TRAIL_TICKS;
        candidates.push({
          id: raider.id,
          x: raider.trailX[index] ?? 0,
          z: raider.trailZ[index] ?? 0,
        });
      }
    }
    return animalInReach(position, aimYaw, candidates)?.id ?? null;
  }

  /** What a raider is in the middle of, for its snapshot. */
  actionOf(raiderId: number): Readonly<ActionState> | null {
    return this.raiders.get(raiderId)?.action ?? null;
  }

  /** Where a raider is. Used by tests. */
  positionOf(raiderId: number): Readonly<Vec3> | null {
    return this.raiders.get(raiderId)?.motion.position ?? null;
  }

  /** Move a raider straight to a spot. Used by tests. */
  placeRaider(raiderId: number, position: Readonly<Vec3>, facingYaw = 0): void {
    const raider = this.raiders.get(raiderId);
    if (raider === undefined) return;
    raider.motion.position.x = position.x;
    raider.motion.position.y = position.y;
    raider.motion.position.z = position.z;
    raider.motion.velocity.x = 0;
    raider.motion.velocity.z = 0;
    raider.motion.facingYaw = facingYaw;
    raider.aimYaw = facingYaw;
    raider.trailCount = 0;
    this.mirror(raider);
  }

  /** Every raider, the way every browser's list of them reads. */
  raidersList(): RaiderView[] {
    const list: RaiderView[] = [];
    for (const raider of this.raiders.values()) {
      list.push({
        id: raider.id,
        kind: raider.kind,
        hitsLeft: Math.max(0, RAIDER_KINDS[raider.kind].toughness - raider.damageTaken),
      });
    }
    return list;
  }

  /** The ids of every raid under way. Used by tests. */
  raidIds(): number[] {
    return [...this.raids.keys()];
  }

  /** The raiders in one raid. Used by tests. */
  raidersOf(raidId: number): number[] {
    return [...(this.raids.get(raidId)?.raiderIds ?? [])];
  }

  /** Seconds of daytime before this player's next raid, or null if they have none counting. Used by tests. */
  countdownOf(netId: number): number | null {
    return this.countdowns.get(netId) ?? null;
  }

  /** Whether the list of raiders changed since this was last asked - a signal to resend it whole. */
  drainListChanged(): boolean {
    const changed = this.listChanged;
    this.listChanged = false;
    return changed;
  }

  drainNews(): RaidNews[] {
    return this.news.splice(0);
  }

  drainHits(): RaiderHit[] {
    return this.hits.splice(0);
  }

  dispose(): void {
    this.raiders.clear();
    this.raids.clear();
  }

  // ---------------------------------------------------------------------------
  // When raids come.

  private countDown(night: boolean): void {
    const pace = night ? RAID.nightPace : 1;
    for (const fighter of this.fighterById.values()) {
      if (!isFightable(fighter) || this.isTargeted(fighter.netId)) continue;
      let left = this.countdowns.get(fighter.netId);
      if (left === undefined) left = this.drawInterval();
      left -= TICK_SECONDS * pace;
      if (left > 0) {
        this.countdowns.set(fighter.netId, left);
        continue;
      }
      if (this.isCrowded(fighter)) {
        this.countdowns.set(fighter.netId, RAID.postponeSeconds);
        continue;
      }
      const raidId = this.startRaid(fighter.netId, undefined, night);
      if (raidId === null) this.countdowns.set(fighter.netId, RAID.postponeSeconds);
    }
    for (const netId of this.countdowns.keys()) {
      if (!this.fighterById.has(netId)) this.countdowns.delete(netId);
    }
  }

  private drawInterval(): number {
    const rng = this.nextRng('interval');
    const max = this.intervalMinSeconds * (RAID.intervalSeconds.max / RAID.intervalSeconds.min);
    return rng.nextRange(this.intervalMinSeconds, max);
  }

  private isTargeted(netId: number): boolean {
    for (const raid of this.raids.values()) if (raid.targetNetId === netId) return true;
    return false;
  }

  /** Too many raids already, or one already close by: this one can wait. */
  private isCrowded(fighter: RaidFighter): boolean {
    if (this.raids.size >= RAID.maxConcurrent) return true;
    for (const raider of this.raiders.values()) {
      const dx = raider.motion.position.x - fighter.position.x;
      const dz = raider.motion.position.z - fighter.position.z;
      if (dx * dx + dz * dz < RAID.crowdedRadius * RAID.crowdedRadius) return true;
    }
    return false;
  }

  /**
   * Somewhere a raid can turn up: about `spawnDistance` from the player,
   * inside the world, and not in the water. Tries round the compass from
   * a random start.
   */
  private spawnCentre(target: Readonly<Vec3>, rng: Rng): { x: number; z: number } | null {
    const start = rng.nextFloat() * TAU;
    const distance = rng.nextRange(RAID.spawnDistance.min, RAID.spawnDistance.max);
    const limit = this.host.collision.boundsHalfExtent - RAID.groupSpacing * 2;
    for (let attempt = 0; attempt < 16; attempt++) {
      // The golden angle walks round the circle without repeating itself.
      const angle = start + attempt * 2.39996;
      const x = target.x + Math.sin(angle) * distance;
      const z = target.z + Math.cos(angle) * distance;
      if (Math.abs(x) > limit || Math.abs(z) > limit) continue;
      if (overlapsWater(this.host.water, x, z, RAID.groupSpacing * 2)) continue;
      return { x, z };
    }
    return null;
  }

  private spawnRaider(
    kind: RaiderKindId,
    raidId: number,
    spot: Readonly<Vec3>,
    facingYaw: number,
  ): RaiderRuntime {
    const id = this.claimRaiderId();
    const position = { x: spot.x, y: 0, z: spot.z };
    resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, this.host.collision);
    position.y = this.host.collision.terrain.heightAt(position.x, position.z);
    const entity = this.world.spawn(
      RaiderTag,
      Position(position),
      Velocity({ x: 0, y: 0, z: 0 }),
      Facing({ yaw: facingYaw }),
      Grounded({ value: true }),
      NetworkId({ value: id }),
    );
    const rng = createRng(hashSeed(this.seed, 'raider', id, this.tick));
    const raider: RaiderRuntime = {
      id,
      kind,
      raidId,
      entity,
      motion: createPlayerMotion(position, facingYaw),
      action: createActionState(),
      rng,
      previousButtons: 0,
      aimYaw: facingYaw,
      damageTaken: 0,
      mode: 'march',
      modeTicks: 0,
      targetNetId: null,
      plannedStrike: false,
      plannedSwings: 1,
      attackBegun: false,
      lastTurnTick: this.tick,
      circleDirection: rng.nextFloat() < 0.5 ? 1 : -1,
      circleTicks: 0,
      pauseTicks: 0,
      standoffOffset: rng.nextRange(-0.5, 0.6),
      detourX: 0,
      detourZ: 0,
      detourTicks: 0,
      stuckTicks: 0,
      noticedSwingTick: -1,
      dodgeAtTick: -1,
      dodgeX: 0,
      dodgeZ: 0,
      breakOutOfFlinch: false,
      staggeredAtTick: -POISE_TICKS,
      trailX: new Float32Array(RAIDER_TRAIL_TICKS),
      trailZ: new Float32Array(RAIDER_TRAIL_TICKS),
      trailHead: 0,
      trailCount: 0,
    };
    // Clawing its way up out of the ground, the way a skeleton should arrive.
    beginAction(raider.action, ActionKind.Rise, RiseFrom.Ground);
    this.raiders.set(id, raider);
    this.listChanged = true;
    return raider;
  }

  private claimRaiderId(): number {
    for (;;) {
      const id = this.nextRaiderId;
      this.nextRaiderId = id >= RAIDER_ID_LAST ? RAIDER_ID_FIRST : id + 1;
      if (!this.raiders.has(id)) return id;
    }
  }

  private nextRng(purpose: string): Rng {
    this.draws += 1;
    return createRng(hashSeed(this.seed, 'raids', purpose, this.draws, this.tick));
  }

  // ---------------------------------------------------------------------------
  // How a raid goes.

  private updateRaid(raid: Raid): void {
    if (raid.leaving) return;
    const target = this.fighterById.get(raid.targetNetId);
    const ageSeconds = (this.tick - raid.startedAtTick) * TICK_SECONDS;
    if (target === undefined || ageSeconds > RAID.maxSeconds) {
      this.giveUp(raid);
      return;
    }
    if (target.outdoors && target.down) {
      // Knocked out: they got what they came for.
      this.giveUp(raid);
      return;
    }
    if (!target.outdoors) {
      raid.waitingTicks += 1;
      if (raid.waitingTicks * TICK_SECONDS > RAID.indoorPatienceSeconds) this.giveUp(raid);
      return;
    }
    raid.waitingTicks = 0;
    raid.lastSeenX = target.position.x;
    raid.lastSeenZ = target.position.z;

    let nearest = Infinity;
    for (const id of raid.raiderIds) {
      const raider = this.raiders.get(id);
      if (raider === undefined || raider.mode === 'down') continue;
      nearest = Math.min(nearest, distanceTo(raider.motion.position, target.position));
    }
    if (nearest > RAID.loseTrackDistance && nearest !== Infinity) {
      raid.lostTicks += 1;
      if (raid.lostTicks * TICK_SECONDS > RAID.loseTrackSeconds) this.giveUp(raid);
    } else {
      raid.lostTicks = 0;
    }
  }

  private giveUp(raid: Raid): void {
    raid.leaving = true;
    for (const id of raid.raiderIds) {
      const raider = this.raiders.get(id);
      if (raider === undefined || raider.mode === 'down') continue;
      this.releaseTurn(raider);
      this.setMode(raider, 'leave');
    }
  }

  private endRaid(raid: Raid, x: number, z: number): void {
    this.raids.delete(raid.id);
    const foughtOff = raid.beaten === raid.size;
    this.news.push({
      kind: foughtOff ? 'foughtOff' : 'gaveUp',
      raidId: raid.id,
      targetNetId: raid.targetNetId,
      count: raid.beaten,
      x,
      z,
    });
  }

  // ---------------------------------------------------------------------------
  // One raider's tick.

  private stepRaider(raider: RaiderRuntime): void {
    raider.modeTicks += 1;
    const raid = this.raids.get(raider.raidId);

    if (raider.mode === 'down') {
      const input = this.standStill(raider);
      this.move(raider, input);
      if (raider.modeTicks >= Math.round(RAID.crumbleSeconds * TICK_HZ)) {
        const { item, count } = RAIDER_KINDS[raider.kind].loot;
        this.host.dropLoot(item, count, raider.motion.position, raider.motion.facingYaw);
        this.despawn(raider);
      }
      return;
    }

    if (raider.mode === 'leave') {
      if (raider.modeTicks >= Math.round(RAID.leaveSeconds * TICK_HZ)) {
        this.despawn(raider);
        return;
      }
      this.move(raider, this.walkAway(raider));
      return;
    }

    const target = this.chooseTarget(raider, raid);
    if (target === null) {
      raider.targetNetId = null;
      if (raider.mode !== 'wait') this.setMode(raider, 'wait');
      this.move(raider, this.waitAbout(raider, raid));
      return;
    }
    if (raider.targetNetId !== target.netId) {
      this.releaseTurn(raider);
      raider.targetNetId = target.netId;
      if (raider.mode === 'attack') this.setMode(raider, 'circle');
    }
    if (raider.mode === 'wait') this.setMode(raider, 'march');

    this.noticeSwings(raider);
    this.move(raider, this.decide(raider, target));
  }

  /**
   * Whom to fight: whoever is right on top of it first, then the player
   * the raid came for, then anybody else close by.
   */
  private chooseTarget(raider: RaiderRuntime, raid: Raid | undefined): RaidFighter | null {
    const here = raider.motion.position;
    let nearest: RaidFighter | null = null;
    let nearestDistance = Infinity;
    for (const fighter of this.fighterById.values()) {
      if (!isFightable(fighter)) continue;
      const distance = distanceTo(here, fighter.position);
      if (distance < nearestDistance) {
        nearest = fighter;
        nearestDistance = distance;
      }
    }
    const current =
      raider.targetNetId === null ? undefined : this.fighterById.get(raider.targetNetId);
    if (current !== undefined && isFightable(current) && distanceTo(here, current.position) < 8) {
      return current;
    }
    if (nearest !== null && nearestDistance < 6) return nearest;
    const wanted = raid === undefined ? undefined : this.fighterById.get(raid.targetNetId);
    if (wanted !== undefined && isFightable(wanted)) return wanted;
    return nearest !== null && nearestDistance < 25 ? nearest : null;
  }

  private decide(raider: RaiderRuntime, target: RaidFighter): PlayerInput {
    const here = raider.motion.position;
    const there = target.position;
    const distance = distanceTo(here, there);
    const facing = Math.atan2(-(there.x - here.x), -(there.z - here.z));
    const kind: RaiderKind = RAIDER_KINDS[raider.kind];

    // A roll it decided on a moment ago, once it is free to make it.
    if (
      raider.dodgeAtTick >= 0 &&
      this.tick >= raider.dodgeAtTick &&
      raider.action.dodgeCooldown === 0 &&
      (raider.action.kind === ActionKind.Idle ||
        (raider.action.kind === ActionKind.Flinch && raider.action.age >= 2))
    ) {
      raider.dodgeAtTick = -1;
      this.releaseTurn(raider);
      this.setMode(raider, 'recover');
      raider.pauseTicks = 10;
      return this.dodgeInput(raider, raider.dodgeX, raider.dodgeZ, facing);
    }
    if (raider.dodgeAtTick >= 0 && this.tick > raider.dodgeAtTick + 6) raider.dodgeAtTick = -1;

    switch (raider.action.kind) {
      case ActionKind.Flinch:
        if (
          raider.breakOutOfFlinch &&
          raider.action.age >= 4 &&
          raider.action.dodgeCooldown === 0
        ) {
          raider.breakOutOfFlinch = false;
          const away = directionTo(there, here);
          return this.dodgeInput(raider, away.x, away.z, facing);
        }
        raider.aimYaw = rotateToward(raider.aimYaw, facing, PLAYER_TURN_RATE * TICK_SECONDS);
        return this.standStill(raider);
      case ActionKind.Dodge:
        return this.standStill(raider);
      default:
        break;
    }

    switch (raider.mode) {
      case 'march':
        if (distance <= RAID.standoff + 1.5) {
          this.setMode(raider, 'circle');
          return this.standStill(raider, facing);
        }
        return this.goToward(
          raider,
          there,
          distance > RAID.runWithin ? RAID.marchSpeed : kind.runSpeed,
        );

      case 'circle':
        return this.circle(raider, target, distance, facing);

      case 'attack':
        return this.attack(raider, target, distance, facing);

      case 'recover':
        if (
          raider.pauseTicks <= 0 &&
          raider.modeTicks === 1 &&
          raider.action.kind === ActionKind.Idle
        ) {
          // Straight after an attack: roll back out of reach, or stand
          // firm and size the player up.
          if (raider.rng.nextFloat() < 0.35 && raider.action.dodgeCooldown === 0) {
            const away = directionTo(there, here);
            raider.pauseTicks = 6;
            return this.dodgeInput(raider, away.x, away.z, facing);
          }
          raider.pauseTicks = 8 + raider.rng.nextInt(10);
        }
        if (raider.pauseTicks > 0) {
          raider.pauseTicks -= 1;
          return this.standStill(raider, facing);
        }
        this.setMode(raider, 'circle');
        return this.standStill(raider, facing);

      default:
        return this.standStill(raider, facing);
    }
  }

  /** Hanging back at the standoff, going round the player, waiting its turn. */
  private circle(
    raider: RaiderRuntime,
    target: RaidFighter,
    distance: number,
    facing: number,
  ): PlayerInput {
    const kind: RaiderKind = RAIDER_KINDS[raider.kind];
    const standoff = RAID.standoff + raider.standoffOffset;

    // Its turn, once the last attack on this player has had a moment to end.
    if (raider.modeTicks > 8 && distance < standoff + 3 && this.claimTurn(raider, target.netId)) {
      this.planAttack(raider);
      this.setMode(raider, 'attack');
      return this.attack(raider, target, distance, facing);
    }

    // Too far off to circle: close the gap first.
    if (distance > standoff + 3) return this.goToward(raider, target.position, kind.runSpeed);

    if (raider.pauseTicks > 0) {
      raider.pauseTicks -= 1;
      return this.standStill(raider, facing);
    }
    raider.circleTicks -= 1;
    if (raider.circleTicks <= 0) {
      raider.circleTicks = 20 + raider.rng.nextInt(30);
      if (raider.rng.nextFloat() < 0.45) {
        raider.pauseTicks = 10 + raider.rng.nextInt(16);
        return this.standStill(raider, facing);
      }
      if (raider.rng.nextFloat() < 0.4) raider.circleDirection = -raider.circleDirection;
    }

    const toward = directionTo(raider.motion.position, target.position);
    // Round the player, drifting in or out to hold the standoff.
    const drift = clampUnit((distance - standoff) * 0.8);
    const x = -toward.z * raider.circleDirection + toward.x * drift;
    const z = toward.x * raider.circleDirection + toward.z * drift;
    return this.walk(raider, x, z, RAID.circleSpeed, facing);
  }

  /** Decide what this attack will be. */
  private planAttack(raider: RaiderRuntime): void {
    const kind: RaiderKind = RAIDER_KINDS[raider.kind];
    raider.attackBegun = false;
    raider.plannedStrike = raider.rng.nextFloat() < kind.strikeChance;
    // Mostly the full combo, sometimes cut short to keep the player guessing.
    raider.plannedSwings =
      kind.comboLength === 1
        ? 1
        : raider.rng.nextFloat() < 0.6
          ? kind.comboLength
          : 1 + raider.rng.nextInt(kind.comboLength);
  }

  /** Its turn: close in, then wind up and swing, or charge a strike. */
  private attack(
    raider: RaiderRuntime,
    target: RaidFighter,
    distance: number,
    facing: number,
  ): PlayerInput {
    const kind: RaiderKind = RAIDER_KINDS[raider.kind];
    const action = raider.action;

    if (!raider.attackBegun) {
      if (distance > RAID.attackRange) {
        // A player who keeps running is let go, and somebody else may try.
        if (raider.modeTicks > 5 * TICK_HZ && distance > RAID.standoff + 4) {
          this.releaseTurn(raider);
          this.setMode(raider, 'circle');
          return this.standStill(raider, facing);
        }
        return this.goToward(raider, target.position, kind.runSpeed);
      }
      raider.attackBegun = true;
      raider.aimYaw = facing;
      if (raider.plannedStrike) {
        return { ...this.standStill(raider, facing), buttons: PlayerButton.Charge };
      }
      beginAction(action, ActionKind.Windup, kind.windup);
      return this.standStill(raider, facing);
    }

    switch (action.kind) {
      // Creeping in along its aim while it draws back, so the blow goes
      // where its body is turned.
      case ActionKind.Windup:
        raider.aimYaw = rotateToward(raider.aimYaw, facing, AIM_TRACKING.windup * TICK_SECONDS);
        return distance > 1.3 ? this.creep(raider) : this.standStill(raider);
      case ActionKind.Charge:
        raider.aimYaw = rotateToward(raider.aimYaw, facing, AIM_TRACKING.charge * TICK_SECONDS);
        return distance > 1.6 ? this.creep(raider) : this.standStill(raider);
      case ActionKind.Swing: {
        raider.aimYaw = rotateToward(raider.aimYaw, facing, AIM_TRACKING.swing * TICK_SECONDS);
        // A fresh click early in each swing queues the next, up to the plan.
        const more = action.step < raider.plannedSwings && action.age === 1;
        return { ...this.standStill(raider), buttons: more ? PlayerButton.Swing : 0 };
      }
      case ActionKind.Strike:
        raider.aimYaw = rotateToward(raider.aimYaw, facing, AIM_TRACKING.swing * TICK_SECONDS);
        return this.standStill(raider);
      case ActionKind.Idle:
        // That attack is over.
        this.releaseTurn(raider);
        this.setMode(raider, 'recover');
        return this.standStill(raider, facing);
      default:
        return this.standStill(raider);
    }
  }

  /**
   * Keep an eye on every player close by: one starting a swing or a strike
   * this raider's way may get rolled away from, a moment later - the
   * chance of it is the raider's `dodgeChance`, decided once per swing.
   */
  private noticeSwings(raider: RaiderRuntime): void {
    if (ATTACKING_KINDS.has(raider.action.kind)) return;
    if (raider.action.dodgeCooldown > 0 || raider.dodgeAtTick >= 0) return;
    const kind: RaiderKind = RAIDER_KINDS[raider.kind];
    const here = raider.motion.position;
    for (const fighter of this.fighterById.values()) {
      if (!isFightable(fighter)) continue;
      const { action } = fighter;
      const starting =
        (action.kind === ActionKind.Swing && action.age <= 1) ||
        (action.kind === ActionKind.Strike && action.age <= 1);
      if (!starting) continue;
      const startedAt = this.tick - action.age;
      if (raider.noticedSwingTick === startedAt) continue;
      const dx = here.x - fighter.position.x;
      const dz = here.z - fighter.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance > DODGE_NOTICE_RADIUS || distance < 1e-6) continue;
      // Only a swing actually aimed its way.
      const forwardX = -Math.sin(fighter.aimYaw);
      const forwardZ = -Math.cos(fighter.aimYaw);
      if ((dx / distance) * forwardX + (dz / distance) * forwardZ < CHOP_FACING_COSINE) continue;
      raider.noticedSwingTick = startedAt;
      if (raider.rng.nextFloat() >= kind.dodgeChance) continue;
      // Sideways, and a little back, the moment it sees it: any later and
      // the player would see the swing land before the roll began.
      const side = raider.rng.nextFloat() < 0.5 ? 1 : -1;
      const x = (dx / distance) * 0.6 - (dz / distance) * side * 0.8;
      const z = (dz / distance) * 0.6 + (dx / distance) * side * 0.8;
      const length = Math.hypot(x, z) || 1;
      raider.dodgeX = x / length;
      raider.dodgeZ = z / length;
      raider.dodgeAtTick = this.tick;
      return;
    }
  }

  /** The player it came for is indoors: wait where they were last seen, by the door. */
  private waitAbout(raider: RaiderRuntime, raid: Raid | undefined): PlayerInput {
    if (raid === undefined) return this.standStill(raider);
    const spot = { x: raid.lastSeenX, y: 0, z: raid.lastSeenZ };
    const distance = distanceTo(raider.motion.position, spot);
    if (distance > RAID.standoff + 1 + raider.standoffOffset) {
      return this.goToward(raider, spot, RAID.marchSpeed);
    }
    // Looking about, now and then.
    if (raider.modeTicks % 40 === 0) raider.aimYaw += raider.rng.nextRange(-1.2, 1.2);
    return this.standStill(raider);
  }

  /** Giving up: walk away from whoever is nearest. */
  private walkAway(raider: RaiderRuntime): PlayerInput {
    const here = raider.motion.position;
    let nearest: Readonly<Vec3> | null = null;
    let nearestDistance = Infinity;
    for (const fighter of this.fighterById.values()) {
      if (!fighter.outdoors) continue;
      const distance = distanceTo(here, fighter.position);
      if (distance < nearestDistance) {
        nearest = fighter.position;
        nearestDistance = distance;
      }
    }
    if (nearest === null) {
      const x = -Math.sin(raider.motion.facingYaw);
      const z = -Math.cos(raider.motion.facingYaw);
      return this.walk(raider, x, z, RAID.marchSpeed, raider.motion.facingYaw);
    }
    const away = directionTo(nearest, here);
    return this.walk(raider, away.x, away.z, RAID.marchSpeed, Math.atan2(-away.x, -away.z));
  }

  // ---------------------------------------------------------------------------
  // Making up inputs.

  private goToward(raider: RaiderRuntime, there: Readonly<Vec3>, speed: number): PlayerInput {
    const toward = directionTo(raider.motion.position, there);
    return this.walk(raider, toward.x, toward.z, speed, Math.atan2(-toward.x, -toward.z));
  }

  /**
   * An input that walks this way at this speed, stepping round other
   * raiders and round whatever it got stuck on.
   */
  private walk(
    raider: RaiderRuntime,
    directionX: number,
    directionZ: number,
    speed: number,
    aimYaw: number,
  ): PlayerInput {
    let x = directionX;
    let z = directionZ;
    // Room for each other.
    const here = raider.motion.position;
    for (const other of this.raiders.values()) {
      if (other === raider || other.mode === 'down') continue;
      const dx = here.x - other.motion.position.x;
      const dz = here.z - other.motion.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= RAID.personalSpace || distance < 1e-6) continue;
      const push = ((RAID.personalSpace - distance) / RAID.personalSpace) * 1.5;
      x += (dx / distance) * push;
      z += (dz / distance) * push;
    }
    if (raider.detourTicks > 0) {
      raider.detourTicks -= 1;
      x = raider.detourX + x * 0.3;
      z = raider.detourZ + z * 0.3;
    }
    const length = Math.hypot(x, z);
    if (length < 1e-6) return this.standStill(raider, aimYaw);
    raider.aimYaw = aimYaw;
    return driveInput(x / length, z / length, speed, aimYaw, 0);
  }

  /** Straight ahead along its aim: a creep, once a wind-up or a charge has its feet. */
  private creep(raider: RaiderRuntime): PlayerInput {
    const aim = raider.aimYaw;
    return driveInput(-Math.sin(aim), -Math.cos(aim), PLAYER_WALK_SPEED, aim, 0);
  }

  private standStill(raider: RaiderRuntime, aimYaw?: number): PlayerInput {
    if (aimYaw !== undefined) raider.aimYaw = aimYaw;
    return { seq: 0, moveX: 0, moveZ: 0, yaw: 0, buttons: 0, aimYaw: raider.aimYaw };
  }

  private dodgeInput(raider: RaiderRuntime, x: number, z: number, facing: number): PlayerInput {
    raider.aimYaw = facing;
    return driveInput(x, z, PLAYER_WALK_SPEED, facing, PlayerButton.Dodge);
  }

  /** Run one input through the player's own moves and movement, then keep the ECS copy in step. */
  private move(raider: RaiderRuntime, input: PlayerInput): void {
    const { motion, action } = raider;
    const beforeX = motion.position.x;
    const beforeZ = motion.position.z;
    const facingBefore = motion.facingYaw;

    const tick = advanceAction(action, input, raider.previousButtons, RAIDER_CONTEXT);
    raider.previousButtons = input.buttons;
    if (tick.footing === 'dodging') {
      stepDodge(motion, action, this.host.collision);
    } else {
      const footed = footedInput(input, tick.footing, motion.facingYaw);
      stepPlayer(motion, footed, TICK_SECONDS, this.host.collision);
      if (footed.moveX === 0 && footed.moveZ === 0) {
        // Not walking anywhere - only knocked back, or sliding to a stop -
        // so it keeps facing what it means to, not the way it is sliding.
        motion.facingYaw = rotateToward(
          facingBefore,
          input.aimYaw,
          PLAYER_TURN_RATE * TICK_SECONDS,
        );
      }
    }
    if (tick.impact !== null) this.landRaiderBlow(raider, tick.impact);

    // Stuck on something: go round it for a bit.
    const wanted = Math.hypot(input.moveX, input.moveZ);
    if (tick.footing === 'free' && wanted > 0.3) {
      const moved = Math.hypot(motion.position.x - beforeX, motion.position.z - beforeZ);
      raider.stuckTicks =
        moved < wanted * PLAYER_WALK_SPEED * TICK_SECONDS * 0.3
          ? raider.stuckTicks + 1
          : Math.max(0, raider.stuckTicks - 1);
      if (raider.stuckTicks >= 8 && raider.detourTicks === 0) {
        const side = raider.rng.nextFloat() < 0.5 ? 1 : -1;
        const dx = input.moveX;
        const dz = -input.moveZ;
        const length = Math.hypot(dx, dz) || 1;
        raider.detourX = (-dz / length) * side;
        raider.detourZ = (dx / length) * side;
        raider.detourTicks = 14;
        raider.stuckTicks = 0;
      }
    }

    raider.trailHead = (raider.trailHead + 1) % RAIDER_TRAIL_TICKS;
    raider.trailX[raider.trailHead] = motion.position.x;
    raider.trailZ[raider.trailHead] = motion.position.z;
    raider.trailCount = Math.min(raider.trailCount + 1, RAIDER_TRAIL_TICKS);
    this.mirror(raider);
  }

  private mirror(raider: RaiderRuntime): void {
    const { motion, entity } = raider;
    entity.set(Position, { x: motion.position.x, y: motion.position.y, z: motion.position.z });
    entity.set(Velocity, { x: motion.velocity.x, y: motion.velocity.y, z: motion.velocity.z });
    entity.set(Facing, { yaw: motion.facingYaw });
    entity.set(Grounded, { value: motion.grounded });
  }

  /**
   * A raider's swing or strike lands: on the nearest player in reach in
   * front of it. It settles a moment later (see `BLOW_SETTLE_TICKS`).
   */
  private landRaiderBlow(raider: RaiderRuntime, impact: Impact): void {
    const kind: RaiderKind = RAIDER_KINDS[raider.kind];
    const candidates: CatchCandidate[] = [];
    for (const fighter of this.fighterById.values()) {
      if (!isFightable(fighter)) continue;
      candidates.push({ id: fighter.netId, x: fighter.position.x, z: fighter.position.z });
    }
    const hit = animalInReach(raider.motion.position, raider.aimYaw, candidates);
    if (hit === null) return;
    const damage =
      impact.kind === 'strike'
        ? kind.strikeDamage
        : impact.step === 3
          ? Math.round(kind.swingDamage * 1.5)
          : kind.swingDamage;
    this.pendingBlows.push({
      targetNetId: hit.id,
      damage,
      impactTick: this.tick,
      x: raider.motion.position.x,
      z: raider.motion.position.z,
    });
  }

  private settleBlows(): void {
    for (let index = this.pendingBlows.length - 1; index >= 0; index--) {
      const blow = this.pendingBlows[index];
      if (blow === undefined || this.tick - blow.impactTick < BLOW_SETTLE_TICKS) continue;
      this.pendingBlows.splice(index, 1);
      const target = this.fighterById.get(blow.targetNetId);
      if (target === undefined || !target.outdoors) continue;
      const dx = target.position.x - blow.x;
      const dz = target.position.z - blow.z;
      const reach = RAID.reach + BLOW_SETTLE_SLACK;
      if (dx * dx + dz * dz > reach * reach) continue;
      this.host.strikePlayer(blow.targetNetId, blow.damage, blow.impactTick);
    }
  }

  // ---------------------------------------------------------------------------
  // Turns, modes and the end.

  private claimTurn(raider: RaiderRuntime, netId: number): boolean {
    let turn = this.turns.get(netId);
    if (turn === undefined) {
      turn = { raiderId: null, freeAtTick: 0 };
      this.turns.set(netId, turn);
    }
    if (turn.raiderId !== null && turn.raiderId !== raider.id) {
      const holder = this.raiders.get(turn.raiderId);
      if (holder !== undefined && holder.mode === 'attack' && holder.targetNetId === netId) {
        return false;
      }
      turn.raiderId = null;
    }
    if (this.tick < turn.freeAtTick) return false;
    // Whoever has been kept waiting longest goes first, so a slow warrior
    // gets its turn as surely as a quick rogue.
    for (const other of this.raiders.values()) {
      if (other === raider || other.targetNetId !== netId || other.mode !== 'circle') continue;
      if (other.modeTicks > 8 && other.lastTurnTick < raider.lastTurnTick) return false;
    }
    turn.raiderId = raider.id;
    raider.lastTurnTick = this.tick;
    return true;
  }

  private releaseTurn(raider: RaiderRuntime): void {
    if (raider.targetNetId === null) return;
    const turn = this.turns.get(raider.targetNetId);
    if (turn === undefined || turn.raiderId !== raider.id) return;
    turn.raiderId = null;
    const gap = raider.rng.nextRange(RAID.turnGapSeconds.min, RAID.turnGapSeconds.max);
    turn.freeAtTick = this.tick + Math.round(gap * TICK_HZ);
  }

  private setMode(raider: RaiderRuntime, mode: RaiderMode): void {
    raider.mode = mode;
    raider.modeTicks = 0;
  }

  private defeat(raider: RaiderRuntime): void {
    this.releaseTurn(raider);
    this.setMode(raider, 'down');
    raider.dodgeAtTick = -1;
    beginAction(raider.action, ActionKind.KnockedOut);
    const raid = this.raids.get(raider.raidId);
    if (raid !== undefined) raid.beaten += 1;
  }

  private despawn(raider: RaiderRuntime): void {
    this.releaseTurn(raider);
    raider.entity.destroy();
    this.raiders.delete(raider.id);
    this.listChanged = true;
    const raid = this.raids.get(raider.raidId);
    if (raid === undefined) return;
    const index = raid.raiderIds.indexOf(raider.id);
    if (index >= 0) raid.raiderIds.splice(index, 1);
    if (raid.raiderIds.length === 0) {
      this.endRaid(raid, raider.motion.position.x, raider.motion.position.z);
    }
  }

  private findFighter(netId: number): RaidFighter | undefined {
    for (const fighter of this.host.fighters()) if (fighter.netId === netId) return fighter;
    return undefined;
  }
}

/** Somebody a raider can go for: out in the world, and on their feet. */
function isFightable(fighter: RaidFighter): boolean {
  return fighter.outdoors && !fighter.down;
}

function distanceTo(from: Readonly<Vec3>, to: Readonly<Vec3>): number {
  return Math.hypot(to.x - from.x, to.z - from.z);
}

function directionTo(from: Readonly<Vec3>, to: Readonly<Vec3>): { x: number; z: number } {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz);
  if (length < 1e-6) return { x: 0, z: 1 };
  return { x: dx / length, z: dz / length };
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/**
 * The input that walks a world direction at a speed, the way a player's
 * keys would: sprinting for anything quicker than a walk, and with the
 * keys only partly pressed for anything slower.
 */
export function driveInput(
  directionX: number,
  directionZ: number,
  speed: number,
  aimYaw: number,
  buttons: number,
): PlayerInput {
  const sprinting = speed > PLAYER_WALK_SPEED;
  const scale = Math.min(1, speed / (sprinting ? PLAYER_SPRINT_SPEED : PLAYER_WALK_SPEED));
  return {
    seq: 0,
    // With the camera's yaw at zero, `moveX` is world X and `moveZ` is world -Z.
    moveX: directionX * scale,
    moveZ: -directionZ * scale,
    yaw: 0,
    buttons: buttons | (sprinting ? PlayerButton.Sprint : 0),
    aimYaw,
  };
}

/** How many raiders this raid brings: one to three, more likely three at night. */
export function drawGroupSize(rng: Rng, night: boolean): number {
  const odds = night ? RAID.groupOdds.night : RAID.groupOdds.day;
  let roll = rng.nextFloat();
  for (let index = 0; index < odds.length; index++) {
    roll -= odds[index] ?? 0;
    if (roll < 0) return index + 1;
  }
  return odds.length;
}

/** Which kinds turn up, by their weights - never more than one warrior. */
export function drawLineup(rng: Rng, size: number): RaiderKindId[] {
  const lineup: RaiderKindId[] = [];
  for (let index = 0; index < size; index++) {
    const choices = RAIDER_KIND_ORDER.filter(
      (kind) => kind !== 'warrior' || !lineup.includes('warrior'),
    );
    const total = choices.reduce((sum, kind) => sum + RAIDER_KINDS[kind].weight, 0);
    let roll = rng.nextFloat() * total;
    let picked: RaiderKindId = choices[0] ?? 'minion';
    for (const kind of choices) {
      roll -= RAIDER_KINDS[kind].weight;
      if (roll < 0) {
        picked = kind;
        break;
      }
    }
    lineup.push(picked);
  }
  return lineup;
}

/** Whether a raider's facing is close enough to an angle to count as looking that way. Used by tests. */
export function isFacing(facingYaw: number, towardYaw: number, tolerance = 0.5): boolean {
  return Math.abs(angleDelta(facingYaw, towardYaw)) <= tolerance;
}
