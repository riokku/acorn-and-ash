import type * as THREE from 'three/webgpu';

import { paintedMaterial } from '../art/materials';
import { ModelBuilder, logGeometry, placed } from '../art/shapes';

/**
 * A rustic split-rail fence piece (see decision 0053): two weathered round
 * posts with a sawn top, and two rails between them, each a little
 * irregular, the same piece a player places over and over to build a line.
 *
 * Its length runs along its own X axis with a post at each end, 1.4 m
 * apart - exactly where the shared footprint puts its two ends, so pieces
 * snapped together share a post.
 */
export interface Fence {
  readonly group: THREE.Group;
  dispose(): void;
}

const SEGMENT_WIDTH = 1.4;
const POST_RADIUS = 0.065;
const POST_HEIGHT = 0.82;
const RAIL_RADIUS = 0.045;
const RAIL_HEIGHTS = [0.34, 0.64];

export function createFence(): Fence {
  // Silvered a little by the weather, rather than fresh honey-coloured wood.
  const weathered = paintedMaterial('wood', { tint: 0xc4b8a6, roughness: 0.95 });
  const ends = paintedMaterial('logEnd', { tint: 0xd4c8b6, roughness: 0.95 });
  const builder = new ModelBuilder();
  // Every piece a little different - and two pieces sharing a post never
  // draw exactly the same surface in exactly the same place.
  const seed = Math.floor(Math.random() * 1_000_000);

  for (const [index, x] of [-SEGMENT_WIDTH / 2, SEGMENT_WIDTH / 2].entries()) {
    const post = logGeometry(POST_HEIGHT, POST_RADIUS * (0.95 + Math.random() * 0.1), {
      sides: 7,
      seed: seed + index,
      wobble: 0.08,
      taper: 0.1,
      tile: 0.8,
      caps: 'end',
      ringEvery: 0.5,
    });
    // Stood up on end, sawn top uppermost, turned a little at random.
    const matrix = placed(x, POST_HEIGHT / 2 - 0.02, 0, {
      y: Math.random() * Math.PI,
      z: Math.PI / 2,
    });
    builder.add(weathered, post.side, matrix).add(ends, post.ends, matrix);
  }

  RAIL_HEIGHTS.forEach((height, index) => {
    const rail = logGeometry(SEGMENT_WIDTH + 0.08, RAIL_RADIUS, {
      sides: 6,
      seed: seed + 10 + index,
      wobble: 0.12,
      taper: 0.08,
      tile: 0.8,
      ringEvery: 0.5,
    });
    // Rails are split, not turned, so they are never quite level or straight.
    const sag = (Math.random() - 0.5) * 0.04;
    const matrix = placed(0, height + sag, (index === 0 ? 1 : -1) * 0.012, {
      z: (Math.random() - 0.5) * 0.03,
      x: Math.random() * Math.PI,
    });
    builder.add(weathered, rail.side, matrix).add(ends, rail.ends, matrix);
  });

  return builder.build();
}
