/**
 * The small living world in front of the painting (decision 0106): drifting
 * mist, the glint of the water, smoke from the cabin's chimney and whatever the
 * season sends down through the air.
 *
 * Everything here is positions and timings in the painting's own pixels, with no
 * canvas, so it can be tested on its own. `backdrop-paint.ts` draws what this
 * works out, and `shared-backdrop.ts` keeps it moving.
 */

import {
  clamp,
  createRng,
  smoothstep,
  type Rng,
  type SeasonId,
  type SeasonMix,
} from '@acorn/shared';

import { fallFor, type FallKind } from '../art/season-fall';

/** The painting is 1672 by 941 pixels, and everything below is measured in them. */
export const PAINTING_WIDTH = 1672;
export const PAINTING_HEIGHT = 941;

/** Where things are in the painting. */
export const SPOTS = {
  /** The top of the cabin's chimney, where the smoke starts. */
  chimney: { x: 1344, y: 517 },
  /** The glowing windows and lamps of the cabin, each with how far its light spreads. */
  windows: [
    { x: 1314, y: 540, radius: 20 },
    { x: 1308, y: 557, radius: 24 },
    { x: 1323, y: 557, radius: 24 },
    { x: 1340, y: 557, radius: 13 },
    { x: 1362, y: 557, radius: 13 },
  ],
  /** The cabin's light, lying on the water below it. */
  reflection: { x: 1312, top: 698, bottom: 762 },
  /** The bands of mist the painting already has: where a drifting patch may wander. */
  mist: [
    { left: 560, right: 1500, top: 330, bottom: 470, width: 520, height: 120 },
    { left: 700, right: 1120, top: 505, bottom: 600, width: 440, height: 80 },
    { left: 480, right: 1450, top: 590, bottom: 650, width: 460, height: 56 },
  ],
} as const;

/** How the season changes the little world: how misty, how smoky, how still the water. */
export interface Weather {
  /** Multiplies how thick the drifting mist is. */
  readonly mist: number;
  /** Multiplies how often a puff of smoke leaves the chimney. */
  readonly smoke: number;
  /** How much the water moves, from 1 (rippling) down to 0.15 (ice). */
  readonly water: number;
  /** Multiplies how brightly the cabin's windows glow. */
  readonly glow: number;
}

const WEATHER: Readonly<Record<SeasonId, Weather>> = {
  spring: { mist: 1.1, smoke: 0.8, water: 1, glow: 0.9 },
  summer: { mist: 0.7, smoke: 0.6, water: 1, glow: 0.85 },
  autumn: { mist: 1.25, smoke: 1, water: 1, glow: 1 },
  winter: { mist: 1.4, smoke: 1.6, water: 0.15, glow: 1.15 },
};

function mixNumber(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

export function weatherFor(mix: SeasonMix): Weather {
  const from = WEATHER[mix.from];
  const to = WEATHER[mix.to];
  return {
    mist: mixNumber(from.mist, to.mist, mix.amount),
    smoke: mixNumber(from.smoke, to.smoke, mix.amount),
    water: mixNumber(from.water, to.water, mix.amount),
    glow: mixNumber(from.glow, to.glow, mix.amount),
  };
}

// --- The things that move -------------------------------------------------

export interface MistPatch {
  band: number;
  x: number;
  y: number;
  /** Painted pixels a second to the right. */
  speed: number;
  alpha: number;
  phase: number;
  width: number;
  height: number;
}

export interface SmokePuff {
  x: number;
  y: number;
  /** Seconds since it left the chimney. */
  age: number;
  life: number;
  phase: number;
}

export interface WaterGlint {
  x: number;
  y: number;
  length: number;
  /** Seconds for one full twinkle. */
  period: number;
  phase: number;
}

export interface WaterRipple {
  x: number;
  y: number;
  length: number;
  speed: number;
  period: number;
  phase: number;
}

export interface Faller {
  kind: FallKind;
  /** Where it sits in the line of things of its kind: the first ones show first as the season fills. */
  slot: number;
  x: number;
  y: number;
  size: number;
  /** Painted pixels a second down (up, for pollen). */
  speed: number;
  sway: number;
  swayRate: number;
  phase: number;
  /** Radians a second it tumbles. */
  spin: number;
  turn: number;
  colour: number;
}

/** How many of each kind there can be at most, when the season is wholly theirs. */
export const FALL_COUNTS: Readonly<Record<FallKind, number>> = {
  leaves: 42,
  snow: 130,
  petals: 34,
  pollen: 46,
};

/** Seconds between puffs of smoke, before the season's own rate is applied. */
const SMOKE_GAP = 0.55;
const MAX_PUFFS = 40;
const GLINTS = 80;
const RIPPLES = 26;

function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

export interface WorldOptions {
  readonly mix: SeasonMix;
  /** Where the water is, as painted pixel positions, so glints only land on it. Can be given later. */
  readonly water?: readonly { x: number; y: number }[];
  /** Leave everything still, for a player who has asked for less motion. */
  readonly reducedMotion: boolean;
  readonly seed?: number;
}

export class BackdropWorld {
  readonly mist: MistPatch[] = [];
  readonly puffs: SmokePuff[] = [];
  readonly glints: WaterGlint[] = [];
  readonly ripples: WaterRipple[] = [];
  readonly fallers: Faller[] = [];
  /** Seconds the world has been running. Does not move while motion is reduced. */
  time = 0;
  weather: Weather;
  /** How full each kind of falling thing is, from 0 to 1. */
  amounts: Readonly<Record<FallKind, number>>;
  /** Scales how many things there are, so a slow computer can be given less to do. */
  detail = 1;

  private readonly rng: Rng;
  private readonly reducedMotion: boolean;
  private untilPuff = 0;

  constructor(options: WorldOptions) {
    this.rng = createRng(options.seed ?? 0x6163_6f72);
    this.reducedMotion = options.reducedMotion;
    this.weather = weatherFor(options.mix);
    this.amounts = fallFor(options.mix);
    this.makeMist();
    this.makeWater(options.water ?? []);
    this.makeFallers();
  }

  /** The painting has been read and the water found: sparkles can start. */
  setWater(water: readonly { x: number; y: number }[]): void {
    this.glints.length = 0;
    this.ripples.length = 0;
    this.makeWater(water);
  }

  /** The season moved on a little: the weather and what is falling follow. */
  setSeason(mix: SeasonMix): void {
    this.weather = weatherFor(mix);
    this.amounts = fallFor(mix);
  }

  /**
   * Whether this falling thing is in the air right now. As a season fills the
   * first of each kind show first, so they arrive one by one, not all at once.
   */
  showing(faller: Faller): boolean {
    return !this.reducedMotion && faller.slot < this.amounts[faller.kind] * this.detail;
  }

  /** Move everything on by this many seconds. */
  step(seconds: number): void {
    // A tab that was in the background comes back with a huge gap, which would
    // fling every leaf a long way, so a step is never more than a fifth of a second.
    const dt = clamp(seconds, 0, 0.2);
    if (this.reducedMotion || dt === 0) return;
    this.time += dt;
    this.stepMist(dt);
    this.stepSmoke(dt);
    this.stepFallers(dt);
  }

  // --- Making things ---

  private makeMist(): void {
    SPOTS.mist.forEach((band, index) => {
      const patches = index === 0 ? 5 : 3;
      for (let i = 0; i < patches; i++) {
        this.mist.push({
          band: index,
          x: this.rng.nextRange(band.left, band.right),
          y: this.rng.nextRange(band.top, band.bottom),
          speed: this.rng.nextRange(3, 9) * (index === 2 ? 0.6 : 1),
          alpha: this.rng.nextRange(0.1, 0.19),
          phase: this.rng.nextRange(0, Math.PI * 2),
          width: band.width * this.rng.nextRange(0.8, 1.25),
          height: band.height * this.rng.nextRange(0.8, 1.2),
        });
      }
    });
  }

  private makeWater(water: readonly { x: number; y: number }[]): void {
    if (water.length === 0) return;
    const spot = (): { x: number; y: number } => this.rng.pick(water);
    for (let i = 0; i < GLINTS; i++) {
      const at = spot();
      this.glints.push({
        x: at.x + this.rng.nextRange(-3, 3),
        y: at.y + this.rng.nextRange(-3, 3),
        length: this.rng.nextRange(6, 22),
        period: this.rng.nextRange(1.6, 4.4),
        phase: this.rng.nextRange(0, 10),
      });
    }
    for (let i = 0; i < RIPPLES; i++) {
      const at = spot();
      this.ripples.push({
        x: at.x,
        y: at.y,
        length: this.rng.nextRange(60, 200),
        speed: this.rng.nextRange(-9, 9),
        period: this.rng.nextRange(7, 14),
        phase: this.rng.nextRange(0, 14),
      });
    }
  }

  private makeFallers(): void {
    const kinds = Object.keys(FALL_COUNTS) as FallKind[];
    for (const kind of kinds) {
      const total = FALL_COUNTS[kind];
      for (let slot = 0; slot < total; slot++) {
        this.fallers.push(this.makeFaller(kind, slot / total));
      }
    }
  }

  private makeFaller(kind: FallKind, slot: number): Faller {
    const rng = this.rng;
    const near = rng.nextFloat();
    const base = {
      kind,
      slot,
      x: rng.nextRange(0, PAINTING_WIDTH),
      y: rng.nextRange(0, PAINTING_HEIGHT),
      phase: rng.nextRange(0, Math.PI * 2),
      turn: rng.nextRange(0, Math.PI * 2),
      colour: rng.nextInt(5),
    };
    switch (kind) {
      case 'leaves':
        return {
          ...base,
          size: rng.nextRange(7, 12),
          speed: rng.nextRange(24, 48),
          sway: rng.nextRange(26, 56),
          swayRate: rng.nextRange(0.5, 1.1),
          spin: rng.nextRange(-2.4, 2.4),
        };
      case 'snow':
        // Bigger flakes are nearer, so they fall faster.
        return {
          ...base,
          size: 1.1 + near * 2.4,
          speed: 14 + near * 30,
          sway: rng.nextRange(8, 22),
          swayRate: rng.nextRange(0.35, 0.9),
          spin: 0,
        };
      case 'petals':
        return {
          ...base,
          size: rng.nextRange(5, 8),
          speed: rng.nextRange(14, 30),
          sway: rng.nextRange(24, 46),
          swayRate: rng.nextRange(0.4, 0.9),
          spin: rng.nextRange(-1.6, 1.6),
        };
      case 'pollen':
        return {
          ...base,
          size: rng.nextRange(1.3, 2.8),
          speed: -rng.nextRange(2, 9),
          sway: rng.nextRange(12, 30),
          swayRate: rng.nextRange(0.25, 0.7),
          spin: 0,
        };
    }
  }

  // --- Moving things ---

  private stepMist(dt: number): void {
    for (const patch of this.mist) {
      const band = SPOTS.mist[patch.band];
      if (band === undefined) continue;
      patch.x += patch.speed * dt;
      // Out of one side, into the other, so there is always mist and it never pops.
      if (patch.x - patch.width / 2 > band.right) patch.x = band.left - patch.width / 2;
    }
  }

  private stepSmoke(dt: number): void {
    let kept = 0;
    for (const puff of this.puffs) {
      puff.age += dt;
      if (puff.age < puff.life) this.puffs[kept++] = puff;
    }
    this.puffs.length = kept;
    this.untilPuff -= dt;
    // At most one puff a step: after a long pause it picks up again, not in a burst.
    if (this.untilPuff <= 0 && this.puffs.length < MAX_PUFFS) {
      this.puffs.push({
        x: SPOTS.chimney.x,
        y: SPOTS.chimney.y,
        age: 0,
        life: this.rng.nextRange(7, 10),
        phase: this.rng.nextRange(0, Math.PI * 2),
      });
      this.untilPuff = SMOKE_GAP / Math.max(0.2, this.weather.smoke);
    }
  }

  private stepFallers(dt: number): void {
    for (const faller of this.fallers) {
      if (!this.showing(faller)) continue;
      faller.y += faller.speed * dt;
      faller.turn += faller.spin * dt;
      if (faller.y > PAINTING_HEIGHT + 20) {
        faller.y = -20;
        faller.x = this.rng.nextRange(0, PAINTING_WIDTH);
      } else if (faller.y < -20) {
        faller.y = PAINTING_HEIGHT + 20;
        faller.x = this.rng.nextRange(0, PAINTING_WIDTH);
      }
    }
  }
}

// --- What each thing looks like right now ----------------------------------

/** Where a falling thing is on screen, with its sideways sway worked out. */
export function fallerX(faller: Faller, time: number): number {
  return wrap(
    faller.x + Math.sin(time * faller.swayRate + faller.phase) * faller.sway,
    PAINTING_WIDTH,
  );
}

/** How bright a glint is, from 0 to 1: a short sharp twinkle in each period. */
export function glintBrightness(glint: WaterGlint, time: number): number {
  const wave = Math.sin(((time + glint.phase) / glint.period) * Math.PI * 2);
  return Math.pow(Math.max(0, wave), 8);
}

/** How strong a ripple line is, from 0 to 1: it fades in, drifts and fades out. */
export function rippleStrength(ripple: WaterRipple, time: number): number {
  const along = wrap((time + ripple.phase) / ripple.period, 1);
  return Math.sin(along * Math.PI);
}

/** A puff of smoke's place, size and see-through-ness, from how old it is. */
export function puffLook(puff: SmokePuff): { x: number; y: number; radius: number; alpha: number } {
  const t = clamp(puff.age / puff.life, 0, 1);
  return {
    // Climbs, leans away to the left as the painted smoke does, and wavers.
    x: puff.x - t * 34 + Math.sin(puff.age * 1.1 + puff.phase) * (3 + t * 9),
    y: puff.y - puff.age * 13,
    radius: 3 + t * 26,
    alpha: 0.3 * smoothstep(t, 0, 0.12) * Math.pow(1 - t, 1.6),
  };
}

/** How brightly the cabin's windows glow: warm, with a slow flicker like a lamp or a fire. */
export function windowGlow(time: number, weather: Weather): number {
  const flicker = 0.9 + Math.sin(time * 2.3) * 0.05 + Math.sin(time * 5.7 + 1.3) * 0.03;
  return clamp(flicker * weather.glow, 0, 1.4);
}
