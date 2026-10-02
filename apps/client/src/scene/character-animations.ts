import * as THREE from 'three/webgpu';

import { loadAnimatedModel } from './model-loading';
import type { MoveClip } from './character-moves';

import libraryUrl from '@assets/animations/character.glb?url';

/**
 * Every character move, loaded once and shared by all six characters: they
 * all use KayKit's Rig_Medium skeleton, bone for bone, so one clip plays on
 * any of them (see decision 0056 and tools/import-animations.mjs).
 *
 * Some clips also come split in two - the upper body and the legs - so a
 * character can eat, reach or fish with their arms while their legs keep
 * walking, standing or running underneath.
 */

/**
 * The bones above the waist, as the loader names them (it drops the dot
 * from `upperarm.l` and the like). The spine turns the whole torso, so an
 * arm move that brings it along reads as one move, not an arm on a stick.
 */
const UPPER_BODY_BONES = new Set([
  'spine',
  'chest',
  'head',
  'upperarml',
  'lowerarml',
  'wristl',
  'handl',
  'handslotl',
  'upperarmr',
  'lowerarmr',
  'wristr',
  'handr',
  'handslotr',
]);

/**
 * Clips worth having in halves: walking about, anything done with the hands
 * on the move, and the first swing, which a raider draws back for while it
 * creeps in (see the wind-up in character-moves.ts).
 */
const SPLIT_CLIPS: readonly MoveClip[] = [
  'attack1',
  'idle',
  'walk',
  'run',
  'jumpAir',
  'pickUp',
  'dig',
  'interact',
  'cast',
  'fishIdle',
  'fishBite',
  'reel',
  'fishCatch',
];

export interface CharacterClips {
  /** Every clip whole. */
  readonly whole: ReadonlyMap<MoveClip, THREE.AnimationClip>;
  /** The same clips, the upper body only. */
  readonly upper: ReadonlyMap<MoveClip, THREE.AnimationClip>;
  /** The same clips, the legs and hips only. */
  readonly lower: ReadonlyMap<MoveClip, THREE.AnimationClip>;
}

let library: CharacterClips | null = null;
let loading: Promise<void> | null = null;

/** Fetches the moves up front. Safe to call as often as you like. */
export function preloadCharacterAnimations(): Promise<void> {
  loading ??= load();
  return loading;
}

/** The moves, once loaded, or null to keep standing still in the meantime. */
export function characterClips(): CharacterClips | null {
  return library;
}

async function load(): Promise<void> {
  try {
    const model = await loadAnimatedModel(libraryUrl);
    const whole = new Map<MoveClip, THREE.AnimationClip>();
    for (const clip of model.clips) whole.set(clip.name as MoveClip, clip);
    const upper = new Map<MoveClip, THREE.AnimationClip>();
    const lower = new Map<MoveClip, THREE.AnimationClip>();
    for (const name of SPLIT_CLIPS) {
      const clip = whole.get(name);
      if (clip === undefined) continue;
      upper.set(
        name,
        keepTracks(clip, `${name}Upper`, (bone) => UPPER_BODY_BONES.has(bone)),
      );
      lower.set(
        name,
        keepTracks(clip, `${name}Lower`, (bone) => !UPPER_BODY_BONES.has(bone)),
      );
    }
    const strike = whole.get('strike');
    const thrown = whole.get('throw');
    if (strike !== undefined && thrown !== undefined) {
      whole.set(
        'chargeHold',
        heldPose('chargeHold', [
          // Legs coiled in the strike's own crouch, ready to leap...
          {
            clip: strike,
            time: CHARGE_CROUCH_SECONDS,
            keep: (bone) => !UPPER_BODY_BONES.has(bone),
          },
          // ...with the arm wound right back over the shoulder, as for a throw.
          {
            clip: thrown,
            time: CHARGE_ARM_BACK_SECONDS,
            keep: (bone) => UPPER_BODY_BONES.has(bone),
          },
        ]),
      );
      // The wound-back arm on its own, for creeping along on walking legs.
      const charge = whole.get('chargeHold');
      if (charge !== undefined) {
        upper.set(
          'chargeHold',
          keepTracks(charge, 'chargeHoldUpper', (bone) => UPPER_BODY_BONES.has(bone)),
        );
      }
    }
    library = { whole, upper, lower };
  } catch (error) {
    // Characters simply keep their own built-in walk and idle without it.
    console.error('Could not load the character animations.', error);
  }
}

/** Where the charged strike's legs are coiled lowest, in seconds into it. */
const CHARGE_CROUCH_SECONDS = 0.22;
/** Where a throw has its arm wound furthest back, in seconds into it. */
const CHARGE_ARM_BACK_SECONDS = 0.55;

/**
 * A pose held still, made from moments of other clips: each part takes the
 * bones `keep` says yes to, frozen at `time` into its clip.
 */
function heldPose(
  name: string,
  parts: readonly {
    clip: THREE.AnimationClip;
    time: number;
    keep: (bone: string) => boolean;
  }[],
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  for (const part of parts) {
    for (const track of part.clip.tracks) {
      if (!part.keep(track.name.split('.')[0] ?? '')) continue;
      // Every track has this once made - three.js sets it up to match the
      // track's own interpolation - but its type definitions leave it out.
      const interpolant = (
        track as unknown as { createInterpolant(): THREE.Interpolant }
      ).createInterpolant();
      const value = Array.from(interpolant.evaluate(part.time) as ArrayLike<number>);
      const TrackType = track.constructor as new (
        name: string,
        times: number[],
        values: number[],
      ) => THREE.KeyframeTrack;
      tracks.push(new TrackType(track.name, [0, 1], [...value, ...value]));
    }
  }
  return new THREE.AnimationClip(name, 1, tracks);
}

/** A copy of a clip with only the tracks for the bones `keep` says yes to. */
function keepTracks(
  clip: THREE.AnimationClip,
  name: string,
  keep: (bone: string) => boolean,
): THREE.AnimationClip {
  const tracks = clip.tracks.filter((track) => keep(track.name.split('.')[0] ?? ''));
  return new THREE.AnimationClip(name, clip.duration, tracks);
}
