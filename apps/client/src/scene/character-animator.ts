import * as THREE from 'three/webgpu';

import { ActionKind, Gesture, TICK_SECONDS } from '@acorn/shared';

import { ArmReach, turnInWorld } from './arm-reach';
import type { CharacterClips } from './character-animations';
import {
  EAT_SECONDS,
  GESTURE_PLAYS,
  blendSeconds,
  eatingPose,
  movePose,
  type EatingPose,
  type MoveClip,
  type MovePose,
  type MoveView,
} from './character-moves';

/** How a character is getting about this frame. */
export interface Locomotion {
  /** Horizontal speed, in metres a second. */
  readonly speed: number;
  readonly airborne: boolean;
}

/** Where somebody's line is at, as far as drawing them goes. */
export type FishingPose = 'casting' | 'waiting' | 'biting' | 'landing';

type Gait = 'idle' | 'walk' | 'run' | 'jumpAir';
const GAITS: readonly Gait[] = ['idle', 'walk', 'run', 'jumpAir'];

/** How fast the gait blend follows a change of pace, per second. */
const GAIT_FOLLOW = 10;
/** The pace each walking clip was made for, as near as looks right. */
const WALK_PACE = 4.5;
/**
 * The slowest the walk plays, as a share of its own pace: slow enough for
 * creeping through a charge's wind-up at a third of walking pace without
 * the feet sliding.
 */
const WALK_SLOWEST = 0.3;
const RUN_PACE = 7;
/** How quickly a hit-stop's lost time is caught back up afterwards, as a share of real time. */
const CATCH_UP = 0.6;

/*
 * Eating, in the rig's own space (the pack's metres, facing +Z, the right
 * hand out along -X), measured off the characters' own heads: where the
 * right hand holds a mouthful, just in front of the mouth, where it holds
 * it between bites, and which way the elbow sticks out meanwhile.
 */
const MOUTHFUL = new THREE.Vector3(-0.1, 1.36, 0.66);
const BETWEEN_BITES = new THREE.Vector3(-0.16, 1.26, 0.84);
const EATING_ELBOW = new THREE.Vector3(-0.9, 0.7, 0);
/** How far the head dips to take each bite, in radians. */
const BITE_NOD = 0.14;

/** One whole-body move clip playing, fading in or out. */
interface MoveLayer {
  readonly key: string;
  readonly clip: MoveClip;
  readonly action: THREE.AnimationAction;
  /**
   * The same clip above the waist only, for a move that lets the legs walk
   * on underneath it (see `MovePose.legsFree`), or null for one that has
   * the whole body.
   */
  readonly upper: THREE.AnimationAction | null;
  weight: number;
  /** Seconds to fade fully in, or out once it is `fading`. */
  fade: number;
  fading: boolean;
}

/** Something done with the arms over the top of walking: a gesture, or fishing. */
interface Overlay {
  readonly clip: MoveClip;
  readonly upper: THREE.AnimationAction;
  readonly lower: THREE.AnimationAction | null;
  /** Seconds since it started. */
  elapsed: number;
  readonly speed: number;
  /** How long it lasts, or null to play on until it is replaced. */
  readonly seconds: number | null;
  readonly loop: boolean;
  weight: number;
  ending: boolean;
  /** What follows on by itself once it is done, crossfading in as it goes. */
  readonly then: FishingPose | null;
}

/**
 * One kind of thing done with the arms, as a stack: the newest fading in,
 * anything before it fading out underneath.
 */
type Channel = Overlay[];

/**
 * Plays a character's moves on its skeleton: walking about underneath,
 * whole-body moves over the top (a swing, a roll, sitting down), and things
 * done with the arms over walking (eating, reaching, fishing) - each faded
 * in and out so nothing pops (see decision 0056).
 *
 * The move itself is never decided here: this only draws whatever
 * `sim/actions.ts` says the character is doing, at the tick it says.
 */
export class CharacterAnimator {
  private readonly mixer: THREE.AnimationMixer;
  private readonly gaitUpper = new Map<Gait, THREE.AnimationAction>();
  private readonly gaitLower = new Map<Gait, THREE.AnimationAction>();
  private readonly gaitWeight: Record<Gait, number> = { idle: 1, walk: 0, run: 0, jumpAir: 0 };
  /**
   * Two of every whole-body clip, used turn and turn about, so a move can
   * fade into another use of the very same clip - one chop into the next.
   */
  private readonly slots: [
    Map<MoveClip, THREE.AnimationAction>,
    Map<MoveClip, THREE.AnimationAction>,
  ];
  private nextSlot = 0;
  private readonly moves: MoveLayer[] = [];
  private readonly upper = new Map<MoveClip, THREE.AnimationAction>();
  private readonly lower = new Map<MoveClip, THREE.AnimationAction>();
  private readonly gestures: Channel = [];
  private readonly fishing: Channel = [];
  /** Last pose requested by the game; automatic clip transitions must not change it. */
  private fishingPose: FishingPose | null = null;
  /** A hit-stop in progress: seconds of it left. */
  private stopLeft = 0;
  /** How far behind the move the drawing is, in seconds, after a hit-stop. */
  private lag = 0;
  private use = 0;
  private swing = 0;
  /** Seconds into eating, or null when not eating. */
  private eatingFor: number | null = null;
  private eatingNow: EatingPose | null = null;
  private readonly rightArm: ArmReach | null;
  private readonly head: THREE.Object3D | null;
  private readonly target = new THREE.Vector3();
  private readonly pole = new THREE.Vector3();
  private readonly nod = new THREE.Quaternion();

  constructor(
    private readonly root: THREE.Object3D,
    clips: CharacterClips,
  ) {
    this.mixer = new THREE.AnimationMixer(root);
    const upperArm = root.getObjectByName('upperarmr');
    const forearm = root.getObjectByName('lowerarmr');
    const hand = root.getObjectByName('handslotr');
    this.rightArm =
      upperArm !== undefined && forearm !== undefined && hand !== undefined
        ? new ArmReach(upperArm, forearm, hand)
        : null;
    this.head = root.getObjectByName('head') ?? null;
    for (const gait of GAITS) {
      const upper = clips.upper.get(gait);
      const lower = clips.lower.get(gait);
      if (upper !== undefined) this.gaitUpper.set(gait, this.start(upper, true));
      if (lower !== undefined) this.gaitLower.set(gait, this.start(lower, true));
    }
    const slotA = new Map<MoveClip, THREE.AnimationAction>();
    const slotB = new Map<MoveClip, THREE.AnimationAction>();
    for (const [name, clip] of clips.whole) {
      slotA.set(name, this.start(clip, false));
      slotB.set(name, this.start(clip.clone(), false));
    }
    this.slots = [slotA, slotB];
    for (const [name, clip] of clips.upper) {
      if (!GAITS.includes(name as Gait)) this.upper.set(name, this.start(clip, false));
    }
    for (const [name, clip] of clips.lower) {
      if (!GAITS.includes(name as Gait)) this.lower.set(name, this.start(clip, false));
    }
  }

  /** Something done with the hands, played over whatever else is going on. */
  playGesture(gesture: Gesture): void {
    if (gesture === Gesture.Eat) {
      this.eatingFor = 0;
      return;
    }
    const play = GESTURE_PLAYS[gesture];
    this.push(
      this.gestures,
      this.overlay(play.clip, play.speed, play.seconds, false, play.wholeBody, null),
    );
  }

  /** Where this character's line is at, or null with no line out. */
  setFishing(pose: FishingPose | null): void {
    if (pose === this.fishingPose) return;
    this.fishingPose = pose;
    this.push(this.fishing, pose === null ? null : this.fishingOverlay(pose));
  }

  /** Freeze the moment a blow lands, for a beat, so it feels like it hit something. */
  hitStop(seconds: number): void {
    this.stopLeft = Math.max(this.stopLeft, seconds);
  }

  /** Whether a hit-stop is holding the moment right now. */
  get stopped(): boolean {
    return this.stopLeft > 0;
  }

  /**
   * How much of the body a move or a line in the water has, from 0 to 1:
   * how far whatever is in hand should be held for using rather than
   * carrying (see `HeldGrips` in character.ts).
   */
  get inUse(): number {
    return this.use;
  }

  /**
   * How much the arms are swinging along with a walk or a run, from 0 to 1:
   * none standing still, or once a move or a gesture has the arms.
   */
  get armSwing(): number {
    return this.swing;
  }

  /** How eating is going, or null when not eating. */
  get eating(): EatingPose | null {
    return this.eatingNow;
  }

  /**
   * Draw this frame: `move` is what the character is doing (with `age` in
   * fractional ticks), `locomotion` how they are getting about.
   */
  update(deltaSeconds: number, move: MoveView, locomotion: Locomotion): MovePose {
    let delta = deltaSeconds;
    if (this.stopLeft > 0) {
      this.stopLeft = Math.max(0, this.stopLeft - deltaSeconds);
      this.lag += deltaSeconds;
      delta = 0;
    } else if (this.lag > 0) {
      this.lag = Math.max(0, this.lag - deltaSeconds * CATCH_UP);
    }

    if (this.eatingFor !== null) {
      this.eatingFor += delta;
      if (this.eatingFor >= EAT_SECONDS) this.eatingFor = null;
    }
    this.eatingNow = this.eatingFor === null ? null : eatingPose(this.eatingFor);

    const pose = movePose({ ...move, age: move.age - this.lag / TICK_SECONDS });
    const stillness = 1 - Math.min(1, locomotion.speed / 1.5);
    this.updateMoves(deltaSeconds, move.kind, pose);
    const moveWeight = Math.min(
      1,
      this.moves.reduce((sum, layer) => sum + layer.weight, 0),
    );
    // How much of the legs moves have: all of it, but for a move that lets
    // them walk on underneath, which hands them back as the walk picks up.
    const moveLegs = Math.min(
      1,
      this.moves.reduce(
        (sum, layer) => sum + layer.weight * (layer.upper === null ? 1 : stillness),
        0,
      ),
    );
    this.updateGaits(deltaSeconds, locomotion);

    // A whole-body move puts a stop to anything the arms were doing.
    if (moveWeight > 0.5) for (const layer of this.gestures) layer.ending = true;
    this.advanceChannel(this.gestures, delta);
    this.advanceChannel(this.fishing, delta);
    const gesture = channelWeights(this.gestures, stillness);
    const fishing = channelWeights(this.fishing, stillness);
    // Gestures come first, fishing under them, walking under both.
    const gestureUpper = gesture.upper;
    const fishingUpper = (1 - gestureUpper) * fishing.upper;
    const gestureLower = gesture.lower;
    const fishingLower = (1 - gestureLower) * fishing.lower;
    this.use = Math.max(moveWeight, fishing.upper);

    // Everything below shares out one whole for the upper body and one for
    // the legs, so blending never falls back to the bind pose or doubles up.
    const free = 1 - moveWeight;
    const freeLegs = 1 - moveLegs;
    const gaitUpper = free * (1 - gestureUpper - fishingUpper);
    const gaitLower = freeLegs * (1 - gestureLower - fishingLower);
    this.swing = gaitUpper * (this.gaitWeight.walk + this.gaitWeight.run);
    for (const gait of GAITS) {
      const share = this.gaitWeight[gait];
      this.gaitUpper.get(gait)?.setEffectiveWeight(gaitUpper * share);
      this.gaitLower.get(gait)?.setEffectiveWeight(gaitLower * share);
    }
    for (const [, action] of this.upper) action.setEffectiveWeight(0);
    for (const [, action] of this.lower) action.setEffectiveWeight(0);
    this.applyMoves(stillness);
    applyChannel(this.gestures, free * gestureUpper, freeLegs * gestureLower, stillness);
    applyChannel(this.fishing, free * fishingUpper, freeLegs * fishingLower, stillness);

    const gaitRate = delta === 0 ? 0 : 1;
    this.gaitRate('walk', gaitRate * clamp(locomotion.speed / WALK_PACE, WALK_SLOWEST, 1.6));
    this.gaitRate('run', gaitRate * clamp(locomotion.speed / RUN_PACE, 0.75, 1.35));
    this.gaitRate('idle', gaitRate);
    this.gaitRate('jumpAir', gaitRate);
    this.mixer.update(deltaSeconds);
    // A whole-body move takes the arm back for itself.
    if (this.eatingNow !== null) this.bringToMouth(this.eatingNow, free);
    return pose;
  }

  dispose(): void {
    this.mixer.stopAllAction();
  }

  /** Steer the right hand up to the mouth, dipping the head for each bite. */
  private bringToMouth(eating: EatingPose, share: number): void {
    const weight = eating.reach * share;
    if (weight <= 0 || this.rightArm === null) return;
    this.root.updateWorldMatrix(true, false);
    this.target.lerpVectors(BETWEEN_BITES, MOUTHFUL, eating.bite);
    this.root.localToWorld(this.target);
    this.root.localToWorld(this.pole.copy(EATING_ELBOW));
    this.rightArm.reach(this.target, this.pole, weight);
    if (this.head !== null) {
      // About the character's own left-to-right: a dip forward, into the food.
      this.pole.set(1, 0, 0).transformDirection(this.root.matrixWorld);
      this.nod.setFromAxisAngle(this.pole, BITE_NOD * eating.bite * weight);
      turnInWorld(this.head, this.nod);
    }
  }

  private start(clip: THREE.AnimationClip, loop: boolean): THREE.AnimationAction {
    const action = this.mixer.clipAction(clip);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    action.clampWhenFinished = true;
    action.enabled = true;
    action.setEffectiveWeight(0);
    action.play();
    if (!loop) action.timeScale = 0;
    return action;
  }

  private gaitRate(gait: Gait, rate: number): void {
    this.gaitUpper.get(gait)?.setEffectiveTimeScale(rate);
    this.gaitLower.get(gait)?.setEffectiveTimeScale(rate);
  }

  private updateGaits(deltaSeconds: number, locomotion: Locomotion): void {
    const target: Record<Gait, number> = { idle: 0, walk: 0, run: 0, jumpAir: 0 };
    if (locomotion.airborne) {
      target.jumpAir = 1;
    } else {
      const moving = smoothstep(0.15, 1.2, locomotion.speed);
      const running = smoothstep(4.9, 6.4, locomotion.speed);
      target.idle = 1 - moving;
      target.walk = moving * (1 - running);
      target.run = moving * running;
    }
    const follow = 1 - Math.exp(-GAIT_FOLLOW * deltaSeconds);
    let total = 0;
    for (const gait of GAITS) {
      this.gaitWeight[gait] += (target[gait] - this.gaitWeight[gait]) * follow;
      total += this.gaitWeight[gait];
    }
    for (const gait of GAITS) this.gaitWeight[gait] /= total > 0 ? total : 1;
  }

  private updateMoves(deltaSeconds: number, kind: ActionKind, pose: MovePose): void {
    const key = pose.clip === null ? null : `${kind}:${pose.clip}:${pose.loop ? 'loop' : 'once'}`;
    const current = this.moves.find((layer) => !layer.fading);
    const fade = blendSeconds(kind);

    if (current !== undefined && current.key !== key) {
      current.fading = true;
      current.fade = key === null ? Math.max(fade, 0.14) : fade;
    }
    if (key !== null && pose.clip !== null && (current === undefined || current.key !== key)) {
      const slot = this.slots[this.nextSlot];
      this.nextSlot = 1 - this.nextSlot;
      const action = slot?.get(pose.clip);
      if (action !== undefined) {
        // The same action may still be on its way out from before: take it over.
        const reused = this.moves.findIndex((layer) => layer.action === action);
        if (reused >= 0) this.moves.splice(reused, 1);
        const upper = pose.legsFree ? (this.upper.get(pose.clip) ?? null) : null;
        this.moves.push({ key, clip: pose.clip, action, upper, weight: 0, fade, fading: false });
      }
    }

    for (let i = this.moves.length - 1; i >= 0; i--) {
      const layer = this.moves[i];
      if (layer === undefined) continue;
      const step = layer.fade > 0 ? deltaSeconds / layer.fade : 1;
      layer.weight = layer.fading ? layer.weight - step : Math.min(1, layer.weight + step);
      if (layer.fading && layer.weight <= 0) {
        layer.action.setEffectiveWeight(0);
        this.moves.splice(i, 1);
        continue;
      }
      if (!layer.fading) {
        const duration = layer.action.getClip().duration;
        layer.action.time = pose.loop
          ? pose.time % Math.max(duration, 1e-3)
          : Math.min(pose.time, duration - 1e-4);
        if (layer.upper !== null) layer.upper.time = layer.action.time;
      }
    }
  }

  /**
   * Share the moves' weight out between their clips: the whole body, or,
   * for one that lets the legs walk on, the same clip above the waist only,
   * more of it the faster the legs are going.
   */
  private applyMoves(stillness: number): void {
    const total = this.moves.reduce((sum, layer) => sum + layer.weight, 0);
    const scale = total > 1 ? 1 / total : 1;
    for (const layer of this.moves) {
      const weight = layer.weight * scale;
      const walking = layer.upper === null ? 0 : 1 - stillness;
      layer.action.setEffectiveWeight(weight * (1 - walking));
      layer.upper?.setEffectiveWeight(layer.upper.getEffectiveWeight() + weight * walking);
    }
  }

  private overlay(
    clip: MoveClip,
    speed: number,
    seconds: number | null,
    loop: boolean,
    wholeBody: boolean,
    then: FishingPose | null,
  ): Overlay | null {
    const upper = this.upper.get(clip);
    if (upper === undefined) return null;
    const lower = wholeBody ? (this.lower.get(clip) ?? null) : null;
    return { clip, upper, lower, elapsed: 0, speed, seconds, loop, weight: 0, ending: false, then };
  }

  private fishingOverlay(pose: FishingPose): Overlay | null {
    switch (pose) {
      case 'casting':
        return this.overlay('cast', 1.4, 1.93 / 1.4, false, true, 'waiting');
      case 'waiting':
        return this.overlay('fishIdle', 1, null, true, true, null);
      case 'biting':
        return this.overlay('fishBite', 1.2, null, true, true, null);
      case 'landing':
        return this.overlay('fishCatch', 1.6, 3.23 / 1.6, false, true, null);
    }
  }

  /** Start something new on a channel, fading out whatever it replaces. */
  private push(channel: Channel, next: Overlay | null): void {
    for (const layer of channel) layer.ending = true;
    if (next === null) return;
    // The same clip already fading out underneath gives way to the new one.
    const reused = channel.findIndex((layer) => layer.upper === next.upper);
    if (reused >= 0) {
      const [old] = channel.splice(reused, 1);
      next.weight = old?.weight ?? 0;
    }
    channel.push(next);
  }

  private advanceChannel(channel: Channel, deltaSeconds: number): void {
    for (let i = channel.length - 1; i >= 0; i--) {
      const layer = channel[i];
      if (layer === undefined) continue;
      layer.elapsed += deltaSeconds;
      if (layer.seconds !== null && !layer.ending && layer.elapsed >= layer.seconds - 0.2) {
        layer.ending = true;
        // A cast carries straight on into waiting for a bite.
        if (layer.then !== null && channel === this.fishing && i === channel.length - 1) {
          const next = this.fishingOverlay(layer.then);
          if (next !== null) channel.push(next);
        }
      }
      layer.weight = layer.ending
        ? layer.weight - deltaSeconds / 0.2
        : Math.min(1, layer.weight + deltaSeconds / 0.12);
      const duration = layer.upper.getClip().duration;
      const time = layer.elapsed * layer.speed;
      const at = layer.loop ? time % Math.max(duration, 1e-3) : Math.min(time, duration - 1e-4);
      layer.upper.time = at;
      if (layer.lower !== null) layer.lower.time = at;
      if (layer.ending && layer.weight <= 0) {
        layer.upper.setEffectiveWeight(0);
        layer.lower?.setEffectiveWeight(0);
        channel.splice(i, 1);
      }
    }
  }
}

/** How much a channel covers, above the waist and below it, all told. */
function channelWeights(channel: Channel, stillness: number): { upper: number; lower: number } {
  let upper = 0;
  let lower = 0;
  for (const layer of channel) {
    upper += Math.max(0, layer.weight);
    if (layer.lower !== null) lower += Math.max(0, layer.weight) * stillness;
  }
  return { upper: Math.min(1, upper), lower: Math.min(1, lower) };
}

/** Share a channel's weight out between its layers, in proportion to how faded in each is. */
function applyChannel(
  channel: Channel,
  upperShare: number,
  lowerShare: number,
  stillness: number,
): void {
  const upperSum = channel.reduce((sum, layer) => sum + Math.max(0, layer.weight), 0);
  const lowerSum = channel.reduce(
    (sum, layer) => sum + (layer.lower === null ? 0 : Math.max(0, layer.weight) * stillness),
    0,
  );
  for (const layer of channel) {
    const own = Math.max(0, layer.weight);
    layer.upper.setEffectiveWeight(upperSum > 0 ? (upperShare * own) / upperSum : 0);
    layer.lower?.setEffectiveWeight(lowerSum > 0 ? (lowerShare * own * stillness) / lowerSum : 0);
  }
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function smoothstep(from: number, to: number, value: number): number {
  const t = clamp((value - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
}

export { ActionKind };
