import { nearSurveySite } from './sunreach-survey';
/** Sunreach: a dry upland reached on foot through Windbreak Pass. */
import { smoothstep, lerp } from '../math/vec3';
import { createRng, hashSeed } from '../rng';
import { fractalNoise2D } from './noise';
import type { PlacedProp } from './clearing';
import type { Terrain } from './terrain';

export const HIGH_PLAINS = {
  id: 'highPlains',
  name: 'Sunreach High Plains',
  x: -219,
  z: -214,
} as const;
export const PLAINS_LANDMARKS = [
  { name: 'Windbreak Pass', x: -139, z: -142 },
  { name: 'Amber Dunes', x: -230, z: -226 },
  { name: 'Crown Mesa', x: -253, z: -167 },
] as const;
export const PLAINS_DENS = [
  { id: 1101, kind: 'jackrabbit', x: -192, z: -193 },
  { id: 1102, kind: 'jackrabbit', x: -224, z: -178 },
  { id: 1103, kind: 'jackrabbit', x: -266, z: -218 },
  { id: 1104, kind: 'jackrabbit', x: -207, z: -251 },
  { id: 1105, kind: 'jackrabbit', x: -264, z: -264 },
  { id: 1106, kind: 'coyote', x: -258, z: -200 },
  { id: 1107, kind: 'coyote', x: -228, z: -262 },
  { id: 1108, kind: 'coyote', x: -280, z: -242 },
] as const;

/** Feathered climate boundary: existing terrain is untouched outside it. */
export function highPlainsWeight(x: number, z: number): number {
  if (x > -100 || z > -100 || x < -335 || z < -325) return 0;
  const radius = Math.hypot((x - HIGH_PLAINS.x) / 78, (z - HIGH_PLAINS.z) / 73);
  const edge = Math.sin(x * 0.037) * Math.sin(z * 0.043) * 0.055;
  return (
    (1 - smoothstep(radius + edge, 0.63, 1.3)) *
    (1 - smoothstep(Math.max(Math.abs(x), Math.abs(z)), 280, 300))
  );
}

const PASS = [
  [-82, -52, 0],
  [-99, -96, 2],
  [-118, -126, 5],
  [-143, -145, 10],
  [-165, -169, 16],
  [-193, -193, 20],
  [-218, -210, 21],
] as const;
export const HIGH_PLAINS_PASS = PASS;

/** Closest point on the graded, obstacle-free route, including its authored elevation. */
export function plainsPassAt(x: number, z: number): { distance: number; height: number } {
  let distance = Infinity,
    height = 0;
  if (x > -53 || x < -230 || z > -48 || z < -222) return { distance, height };
  for (let i = 1; i < PASS.length; i++) {
    const a = PASS[i - 1]!,
      b = PASS[i]!;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    const gap = Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    if (gap < distance) {
      distance = gap;
      height = lerp(a[2], b[2], t);
    }
  }
  return { distance, height };
}

/** Dunes collect in broad pockets, leaving golden steppe between them. */
export function highPlainsSand(x: number, z: number): number {
  const weight = highPlainsWeight(x, z);
  if (weight === 0) return 0;
  const dunes = Math.exp(-(((x + 230) / 53) ** 2 + ((z + 234) / 44) ** 2));
  const pockets = 0.75 + Math.sin(x * 0.047 + Math.sin(z * 0.061)) * 0.25;
  return weight * Math.min(1, 0.12 + dunes * pockets * 1.3);
}

export function highPlainsHeightAt(seed: number, x: number, z: number, ground: number): number {
  const weight = highPlainsWeight(x, z);
  if (weight > 0) {
    const rolling = (fractalNoise2D(seed + 89131, x / 68, z / 68, 2) - 0.5) * 4;
    // Long windward ramps and shorter slip faces make actual dune crests,
    // with gently wandering ridges rather than evenly rounded hills.
    const phase = x / 36 + z / 78 + Math.sin(z / 29) * 0.12;
    const across = phase - Math.floor(phase);
    const ridge = across < 0.72 ? across / 0.72 : (1 - across) / 0.28;
    const dunes = highPlainsSand(x, z) * ridge ** 1.25 * 5.2;
    const mesaRadius = Math.hypot((x + 253) / 23, (z + 167) / 19);
    ground = lerp(ground, 19 + rolling + dunes, weight);
    const mesa = 1 - smoothstep(mesaRadius, 0.7, 1.55);
    ground = lerp(ground, 31 + rolling * 0.1, mesa);
  }
  const pass = plainsPassAt(x, z);
  return lerp(ground, pass.height, 1 - smoothstep(pass.distance, 2.8, 9));
}

/** Numbered in their own range; adding this region never renumbers saved forest trees. */
export function buildHighPlainsRocks(seed: number, terrain: Terrain): PlacedProp[] {
  const rocks: PlacedProp[] = [];
  const rng = createRng(hashSeed(seed, 'sunreach-rocks'));
  for (let index = 0; index < 90; index++) {
    const x = rng.nextRange(-290, -152),
      z = rng.nextRange(-289, -135);
    const scale = rng.nextRange(0.8, 3.8);
    if (highPlainsWeight(x, z) < 0.38 || plainsPassAt(x, z).distance < 7 + scale * 1.2) continue;
    if (nearSurveySite(x, z, scale * 1.2)) continue;
    if (PLAINS_DENS.some((den) => Math.hypot(x - den.x, z - den.z) < 7 + scale * 1.2)) continue;
    if (rocks.some((rock) => Math.hypot(x - rock.x, z - rock.z) < (scale + rock.scale) * 0.9))
      continue;
    rocks.push({
      id: 46000 + index,
      kind: 'boulder',
      x,
      z,
      y: terrain.heightAt(x, z),
      scale,
      rotationY: rng.nextRange(0, Math.PI * 2),
    });
  }
  return rocks;
}

/** Scattered conifers thin into the steppe rather than ending at a hard oval boundary. */
export function plainsAllowsTree(seed: number, treeId: number, x: number, z: number): boolean {
  const weight = highPlainsWeight(x, z);
  if (weight <= 0.03) return true;
  if (weight >= 0.55) return false;
  return (
    createRng(hashSeed(seed, 'sunreach-canopy', treeId)).nextFloat() >
    smoothstep(weight, 0.03, 0.55)
  );
}
