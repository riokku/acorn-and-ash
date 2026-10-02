import type * as THREE from 'three/webgpu';

import {
  ActionKind,
  DODGE,
  RAIDER_BLOW_WEIGHT,
  RAID,
  RAIDER_KIND_ORDER,
  RAIDER_KINDS,
  createActionState,
  unpackActionByte,
  type RaiderHit,
  type RaiderKindId,
  type RaiderView,
  type SnapshotEntity,
} from '@acorn/shared';

import { InterpolatedEntities } from '../net/interpolated-entities';
import type { Character } from './character';
import { MoveMemory, rollDirection } from './character-driver';
import type { ImpactBursts } from './impact-bursts';
import { RaiderFigure } from './raider-figure';

/**
 * Every skeleton raider in sight, drawn (see decision 0063): where each is,
 * from the snapshots, a tenth of a second behind like any other player; what
 * kind each is and how many blows each still needs, from the server's
 * list; and the blows landing on them, shown the moment our own swing
 * connects and confirmed when the server says so.
 */

/** A flat point, ignoring height. */
export interface FlatPoint {
  readonly x: number;
  readonly z: number;
}

/** A raider a swing could land on. */
export interface RaiderTarget {
  readonly id: number;
  readonly x: number;
  /** Where its feet are, for clicking on it. */
  readonly y: number;
  readonly z: number;
}

/** A raider worth pointing out on screen. */
export interface RaiderMarker {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Drawing back to swing, or swinging, right now. */
  readonly attacking: boolean;
}

/** What one of our own blows did, as far as can be told before the server says. */
export type PredictedBlow = 'hit' | 'shrugged' | 'missed';

/** Closer than this, a raider's health bar shows even before it is hurt. */
const BAR_SHOWS_WITHIN = 9;
/** Further off than this, a raider can no longer be heard. */
const HEARD_WITHIN = 40;
/** How long after a stagger a raider shrugs off light blows (see `POISE_TICKS`), in seconds. */
const POISE_SECONDS = 1.2;

/** The moves a blow lands from. */
const SWINGING: ReadonlySet<ActionKind> = new Set([ActionKind.Swing, ActionKind.Strike]);

/** How far under the ground the stand-ins are drawn while rehearsing, in metres: well out of sight. */
const REHEARSAL_DEPTH = 40;
/** The most raiders one raid brings: as many of each kind as are rehearsed. */
const LARGEST_GROUP = RAID.groupOdds.night.length;

const ATTACKING: ReadonlySet<ActionKind> = new Set([
  ActionKind.Windup,
  ActionKind.Swing,
  ActionKind.Charge,
  ActionKind.Strike,
]);

export class RaiderCrowd {
  private readonly positions = new InterpolatedEntities();
  private readonly figures = new Map<number, RaiderFigure>();
  private readonly memories = new Map<number, MoveMemory>();
  private readonly kinds = new Map<number, RaiderKindId>();
  private readonly hitsLeft = new Map<number, number>();
  /** When each last staggered, in seconds on `clock`, to tell a blow that will be shrugged off. */
  private readonly staggeredAt = new Map<number, number>();
  private readonly departing: RaiderFigure[] = [];
  /** Skeletons drawn once out of sight, to be put by as spares (see `rehearse`). */
  private readonly standIns: RaiderFigure[] = [];
  private rehearsal: 'over' | 'due' | 'drawn' = 'over';
  /** The bodies of skeletons done with, by kind, to be used again rather than built anew. */
  private readonly spares = new Map<RaiderKindId, Character[]>();
  private readonly action = createActionState();
  private clock = 0;

  constructor(
    private readonly parent: THREE.Object3D,
    private readonly bursts: ImpactBursts,
  ) {}

  /**
   * Draw a whole raid's worth of every kind once, a long way under the
   * ground near `at`, while the world is still loading (see decision 0063).
   *
   * The first time the graphics card draws a skeleton, it has to work out
   * how, and that can freeze the game for a moment: right as a raid turns
   * up, the worst moment for it. Done now, that happens behind the loading
   * screen instead. The card works it out afresh for every new skeleton's
   * shadow, so these are then put by as spares and used again for every raid
   * after, never thrown away: building new ones would bring the freeze back.
   */
  rehearse(at: FlatPoint): void {
    if (this.rehearsal !== 'over' || this.spares.size > 0) return;
    for (const kind of RAIDER_KIND_ORDER) {
      for (let n = 0; n < LARGEST_GROUP; n++) {
        const figure = RaiderFigure.create(kind, this.parent, this.bursts);
        if (figure === null) continue;
        figure.showEverythingAt(at.x, -REHEARSAL_DEPTH, at.z);
        this.standIns.push(figure);
      }
    }
    if (this.standIns.length > 0) this.rehearsal = 'due';
  }

  /** The server's list: which kind each raider is, and how many blows each still needs. */
  setList(raiders: readonly RaiderView[]): void {
    this.kinds.clear();
    for (const raider of raiders) {
      this.kinds.set(raider.id, raider.kind);
      this.hitsLeft.set(raider.id, raider.hitsLeft);
    }
    for (const id of this.hitsLeft.keys()) if (!this.kinds.has(id)) this.hitsLeft.delete(id);
  }

  /** The raiders in a snapshot - only ever those - and nobody else's. */
  ingest(serverTimeMs: number, entities: readonly SnapshotEntity[]): void {
    this.positions.ingest(serverTimeMs, entities);
    const present = new Set(entities.map((entity) => entity.netId));
    for (const id of this.positions.retainOnly(present)) this.letGo(id);
  }

  /**
   * A blow the server says landed. One of our own was already shown as it
   * landed here (see `predictBlow`), so only the count changes for it.
   */
  confirmHit(
    hit: RaiderHit,
    from: FlatPoint | undefined,
    ours: boolean,
    listener: FlatPoint | null,
  ): void {
    this.hitsLeft.set(hit.raiderId, hit.hitsLeft);
    if (!hit.shrugged) this.staggeredAt.set(hit.raiderId, this.clock);
    if (ours || from === undefined) return;
    this.show(hit.raiderId, from, hit.heavy ? 1.5 : 1, hit.shrugged, listener);
  }

  /**
   * One of our own blows landing on this raider, shown straight away: a
   * whiff if it is mid-roll, sparks off one that will shrug it off, or the
   * real thing. `heavy` for the combo's finisher, `strike` for a charged one.
   */
  predictBlow(id: number, from: FlatPoint, heavy: boolean, strike: boolean): PredictedBlow {
    const pose = this.positions.poseOf(id);
    const kind = this.kinds.get(id);
    if (pose === undefined || kind === undefined) return 'missed';
    const action = unpackActionByte(pose.action, this.action);
    if (action.kind === ActionKind.Dodge && pose.actionAge < DODGE.invulnerable) return 'missed';
    const weight = strike
      ? RAIDER_BLOW_WEIGHT.strike
      : heavy
        ? RAIDER_BLOW_WEIGHT.finisher
        : RAIDER_BLOW_WEIGHT.swing;
    const left = this.hitsLeft.get(id) ?? RAIDER_KINDS[kind].toughness;
    const light = !strike && !heavy;
    const steady =
      (RAIDER_KINDS[kind].steadfast && ATTACKING.has(action.kind)) ||
      this.clock - (this.staggeredAt.get(id) ?? -Infinity) < POISE_SECONDS;
    const shrugged = light && steady && left - weight > 0;
    this.show(id, from, strike ? 1.8 : heavy ? 1.4 : 1, shrugged, null);
    return shrugged ? 'shrugged' : 'hit';
  }

  /** Every raider still standing, for working out which one a swing would find. */
  targets(): RaiderTarget[] {
    const targets: RaiderTarget[] = [];
    for (const id of this.positions.netIds()) {
      const pose = this.positions.poseOf(id);
      if (pose === undefined) continue;
      if (unpackActionByte(pose.action, this.action).kind === ActionKind.KnockedOut) continue;
      targets.push({ id, x: pose.x, y: pose.y, z: pose.z });
    }
    return targets;
  }

  /** Every raider still standing, and whether it is coming at somebody right now. */
  markers(): RaiderMarker[] {
    const markers: RaiderMarker[] = [];
    for (const id of this.positions.netIds()) {
      const pose = this.positions.poseOf(id);
      if (pose === undefined) continue;
      const kind = unpackActionByte(pose.action, this.action).kind;
      if (kind === ActionKind.KnockedOut) continue;
      markers.push({ id, x: pose.x, y: pose.y, z: pose.z, attacking: ATTACKING.has(kind) });
    }
    return markers;
  }

  /**
   * The closest raider mid-swing within `within` metres of `at`, if any:
   * the one most likely to have landed the blow that just hurt us.
   */
  swingingNear(at: FlatPoint, within: number): FlatPoint | null {
    let nearest: FlatPoint | null = null;
    let nearestDistance = within;
    for (const id of this.positions.netIds()) {
      const pose = this.positions.poseOf(id);
      if (pose === undefined) continue;
      if (!SWINGING.has(unpackActionByte(pose.action, this.action).kind)) continue;
      const distance = Math.hypot(pose.x - at.x, pose.z - at.z);
      if (distance > nearestDistance) continue;
      nearest = { x: pose.x, z: pose.z };
      nearestDistance = distance;
    }
    return nearest;
  }

  /** What kind of raider this is, and how many blows it still needs, if known. */
  describe(id: number): { kind: RaiderKindId; hitsLeft: number } | null {
    const kind = this.kinds.get(id);
    if (kind === undefined) return null;
    return { kind, hitsLeft: this.hitsLeft.get(id) ?? RAIDER_KINDS[kind].toughness };
  }

  /** How many raiders are in sight right now. */
  get count(): number {
    return this.positions.netIds().length;
  }

  /**
   * Draw them all this frame. `listener` is the local player, for how loud
   * each one sounds and whether its health bar is worth showing; `aimedId`
   * the one a swing would land on, whose bar is named.
   */
  update(deltaSeconds: number, listener: FlatPoint | null, aimedId: number | null): void {
    this.endRehearsal();
    this.clock += deltaSeconds;
    this.positions.advance(deltaSeconds);
    for (const id of this.positions.netIds()) {
      const pose = this.positions.poseOf(id);
      if (pose === undefined) continue;
      const figure = this.figureFor(id);
      if (figure === null) continue;
      const action = unpackActionByte(pose.action, this.action);
      const memory = this.memories.get(id) ?? new MoveMemory();
      this.memories.set(id, memory);
      const move = memory.view(
        action.kind,
        action.step,
        pose.actionAge,
        false,
        rollDirection(pose.actionHeading, pose.yaw),
      );
      const distance = listener === null ? 0 : Math.hypot(pose.x - listener.x, pose.z - listener.z);
      figure.draw(
        deltaSeconds,
        pose,
        { move, locomotion: { speed: pose.speed, airborne: pose.airborne } },
        volumeAt(distance),
      );
      const kind = RAIDER_KINDS[figure.kind];
      const left = this.hitsLeft.get(id) ?? kind.toughness;
      figure.bar.setHealth(left / kind.toughness);
      const hurt = left < kind.toughness;
      figure.bar.setWanted(
        !figure.down && (hurt || id === aimedId || distance < BAR_SHOWS_WITHIN),
        id === aimedId,
      );
    }
    for (let i = this.departing.length - 1; i >= 0; i--) {
      const figure = this.departing[i];
      if (figure === undefined) continue;
      figure.fade(deltaSeconds);
      if (figure.gone) {
        this.putBy(figure);
        this.departing.splice(i, 1);
      }
    }
  }

  /** Everybody gone at once: going indoors, or a fresh connection. */
  clear(): void {
    for (const id of this.positions.netIds()) {
      this.positions.remove(id);
      const figure = this.forget(id);
      if (figure !== undefined) this.putBy(figure);
    }
    for (const figure of this.departing) this.putBy(figure);
    this.departing.length = 0;
  }

  dispose(): void {
    this.clear();
    for (const figure of this.standIns) figure.dispose();
    this.standIns.length = 0;
    for (const bodies of this.spares.values()) for (const body of bodies) body.dispose();
    this.spares.clear();
  }

  /**
   * Put the stand-ins by once they have been drawn. This runs just before
   * each frame is drawn, so it lets one frame through first: one out of
   * doors, drawn in the same light raiders are fought in.
   */
  private endRehearsal(): void {
    if (this.rehearsal === 'drawn') {
      for (const figure of this.standIns) this.putBy(figure);
      this.standIns.length = 0;
      this.rehearsal = 'over';
    } else if (this.rehearsal === 'due' && showing(this.parent)) {
      this.rehearsal = 'drawn';
    }
  }

  /** Done with a skeleton: its body kept to be used again (see `rehearse`). */
  private putBy(figure: RaiderFigure): void {
    const bodies = this.spares.get(figure.kind) ?? [];
    bodies.push(figure.retire());
    this.spares.set(figure.kind, bodies);
  }

  private figureFor(id: number): RaiderFigure | null {
    const existing = this.figures.get(id);
    if (existing !== undefined) return existing;
    const kind = this.kinds.get(id);
    // Not on the list yet: drawn as soon as the server says what it is.
    if (kind === undefined) return null;
    const spare = this.spares.get(kind)?.pop() ?? null;
    const figure = RaiderFigure.create(kind, this.parent, this.bursts, spare);
    if (figure !== null) this.figures.set(id, figure);
    return figure;
  }

  private show(
    id: number,
    from: FlatPoint,
    strength: number,
    shrugged: boolean,
    listener: FlatPoint | null,
  ): void {
    const figure = this.figures.get(id);
    const pose = this.positions.poseOf(id);
    if (figure === undefined || pose === undefined) return;
    const dx = pose.x - from.x;
    const dz = pose.z - from.z;
    const length = Math.hypot(dx, dz) || 1;
    const volume =
      listener === null ? 1 : volumeAt(Math.hypot(pose.x - listener.x, pose.z - listener.z));
    figure.struck(dx / length, dz / length, strength, shrugged, volume);
  }

  /** Gone from the snapshots: beaten and fallen apart, or walked off and out of sight. */
  private letGo(id: number): void {
    const figure = this.forget(id);
    if (figure === undefined) return;
    if (figure.down) {
      figure.scatter();
      this.putBy(figure);
    } else {
      figure.depart();
      this.departing.push(figure);
    }
  }

  private forget(id: number): RaiderFigure | undefined {
    const figure = this.figures.get(id);
    this.figures.delete(id);
    this.memories.delete(id);
    this.staggeredAt.delete(id);
    return figure;
  }
}

/** How loud something this far off sounds, from 1 close by down to nothing out of earshot. */
function volumeAt(distance: number): number {
  return Math.max(0, 1 - distance / HEARD_WITHIN) ** 1.5;
}

/** Whether something would be drawn at all, with nothing it hangs from hidden. */
function showing(object: THREE.Object3D): boolean {
  for (let at: THREE.Object3D | null = object; at !== null; at = at.parent) {
    if (!at.visible) return false;
  }
  return true;
}
