/**
 * The shape of the far country beyond the edge of the world (decision 0286):
 * three rings of forested ridges, each further and paler than the last, and
 * Ash Peak, the great snow-capped volcano standing over the lake.
 *
 * Nobody can walk there, so this is scenery only. It is still built from the
 * world's seed, so every player in a world looks out at the same skyline.
 *
 * Plain numbers in and out, no Three.js, so it can be tested on its own.
 */

import { fractalNoise2D } from '@acorn/shared';

export interface RidgeLayer {
  readonly name: 'near' | 'middle' | 'far';
  /** Metres from the middle of the world to the ridge. */
  readonly radius: number;
  /** How many slices the ring is cut into. More slices give finer tree tops. */
  readonly segments: number;
  /** The lowest and highest the crest runs, in metres. */
  readonly low: number;
  readonly high: number;
  /** How many broad rises fit round the ring. */
  readonly rises: number;
  /** 0 for rounded forested hills, 1 for sharp alpine peaks. */
  readonly sharpness: number;
  /** Metres of ragged tree tops along the crest. */
  readonly treeTops: number;
  /** How far the crest dips where it passes in front of Ash Peak, 0 to 1. */
  readonly dip: number;
}

/**
 * Nearest first. The nearest starts beyond the 470 m where the ground ends, and
 * each is tall enough to stand over the one in front of it.
 */
export const RIDGE_LAYERS: readonly RidgeLayer[] = [
  {
    name: 'near',
    radius: 640,
    segments: 1440,
    low: 34,
    high: 96,
    rises: 9,
    sharpness: 0,
    treeTops: 7,
    dip: 0.35,
  },
  {
    name: 'middle',
    radius: 900,
    segments: 1024,
    low: 70,
    high: 190,
    rises: 7,
    sharpness: 0.45,
    treeTops: 5,
    dip: 0.5,
  },
  {
    name: 'far',
    radius: 1250,
    segments: 640,
    low: 120,
    high: 330,
    rises: 6,
    sharpness: 1,
    treeTops: 0,
    dip: 0.62,
  },
];

/**
 * Where Ash Peak stands: north-east of the home clearing, straight out across
 * the lake, so the open water gives a clear view of it. North is -z.
 */
export const ASH_PEAK = {
  x: 1170,
  z: -1170,
  /** The model is made at 1:100 (tools/art/ash_peak.py). */
  scale: 110,
  /** Metres from base to summit once scaled. */
  height: 730,
} as const;

/** How far a camera has to see to hold Ash Peak and the sky from the furthest corner of the world. */
export const SKYLINE_VIEW_DISTANCE = 4000;

/** The compass angle, in radians, from the middle of the world to a point. */
export function bearingTo(x: number, z: number): number {
  return Math.atan2(z, x);
}

const PEAK_BEARING = bearingTo(ASH_PEAK.x, ASH_PEAK.z);
/** How wide the gap in the ridges in front of Ash Peak is, in radians. */
const DIP_WIDTH = 0.5;

function hash01(seed: number, index: number): number {
  let h = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 0x1_0000_0000;
}

function angleBetween(a: number, b: number): number {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

/**
 * How high the crest of a ridge stands at each slice round its ring, in metres.
 * Slice `i` is at the angle `i / segments` of a full turn, and the last slice
 * meets the first without a seam.
 */
export function ridgeCrest(seed: number, layer: RidgeLayer): number[] {
  const layerSeed = seed + layer.radius * 7919;
  const crest: number[] = [];
  for (let i = 0; i < layer.segments; i++) {
    const angle = (i / layer.segments) * Math.PI * 2;
    // Walking round a circle through the noise brings the end back to the start.
    const nx = Math.cos(angle) * layer.rises * 0.5;
    const nz = Math.sin(angle) * layer.rises * 0.5;
    const rolling = fractalNoise2D(layerSeed, nx + 40, nz + 40, 4);
    // Folding the noise about its middle turns round hills into pointed peaks.
    const folded =
      1 - Math.abs(fractalNoise2D(layerSeed + 17, nx * 1.7 + 90, nz * 1.7 + 90, 4) * 2 - 1);
    const peaked = Math.pow(folded, 1.6);
    const shape = rolling * (1 - layer.sharpness) + peaked * layer.sharpness;
    // Stretched so crests seldom reach the very top, where they would all be cut off level.
    const spread = Math.min(1, Math.max(0, (shape - 0.2) / 0.72));
    let height = layer.low + (layer.high - layer.low) * spread;
    const away = angleBetween(angle, PEAK_BEARING) / DIP_WIDTH;
    height *= 1 - layer.dip * Math.exp(-away * away);
    height += hash01(layerSeed, i) * layer.treeTops;
    crest.push(height);
  }
  return crest;
}

export interface SkylineWeather {
  /** 0 is midnight, 1 is noon. */
  readonly daylight: number;
  /** How much of the sky is rain cloud, 0 to 1. */
  readonly cloud: number;
  /** 1 in a blizzard, easing in and out. */
  readonly whiteout: number;
  /** 1 deep underground. */
  readonly underground: number;
}

/**
 * How clearly the far country shows, from 0 (lost in cloud) to 1 (a clear day).
 * Rain closes in, a blizzard hides everything, and there is no view underground.
 */
export function skylineClarity(weather: SkylineWeather): number {
  const rain = 1 - Math.min(1, Math.max(0, weather.cloud)) * 0.9;
  const open = (1 - Math.min(1, Math.max(0, weather.whiteout))) * (1 - weather.underground);
  return Math.min(1, Math.max(0, rain * open));
}

/**
 * How much of a piece of the skyline shows through the air in front of it.
 * `distance` is 0 for the nearest ridge and 1 for Ash Peak: the further away,
 * the sooner weather swallows it, so "the mountain is out" only on a clear day.
 */
export function showingThrough(clarity: number, distance: number): number {
  return Math.pow(Math.min(1, Math.max(0, clarity)), 0.6 + distance * 1.6);
}

/**
 * The pink light that catches high snow just after sunset and before sunrise,
 * 0 to 1. It peaks while the sun is a little below half strength.
 */
export function alpenglow(daylight: number): number {
  const from = (daylight - 0.36) / 0.2;
  return Math.exp(-from * from);
}
