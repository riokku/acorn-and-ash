import { SKELETON_TOWN } from './skeleton-town';
import { lerp, smoothstep } from '../math/vec3';
import type { EncounterSite } from './encounters';

/** The Last Watch's abandoned road, from Bonehollow's southern edge to a safe muster point. */
export const KINGS_ROAD = [
  { x: 187, z: 161 },
  { x: 194, z: 169 },
  { x: 202, z: 173 },
  { x: 208, z: 181 },
  { x: 217, z: 187 },
  { x: 229, z: 193 },
] as const;
export const KING_MUSTER = { x: 229, z: 193, radius: 4.5, name: 'The Last Muster' } as const;
export const KING_APPROACH: readonly EncounterSite[] = [
  {
    id: 501,
    kind: 'ruins',
    strongholdStage: 'scouts',
    x: 202,
    z: 173,
    yaw: 0,
    noticeRadius: 9,
    wakeRadius: 48,
    leashRadius: 18,
    restSeconds: 600,
  },
  {
    id: 502,
    kind: 'ruins',
    strongholdStage: 'watch',
    x: 217,
    z: 187,
    yaw: 0,
    noticeRadius: 10,
    wakeRadius: 48,
    leashRadius: 20,
    restSeconds: 600,
  },
];
export const KING_APPROACH_LINEUPS = {
  scouts: ['rogue', 'minion'],
  watch: ['sentinel', 'warrior', 'mage'],
} as const;
const segments = KINGS_ROAD.slice(1).map((b, i) => ({
  a: KINGS_ROAD[i]!,
  b,
  length: Math.hypot(b.x - KINGS_ROAD[i]!.x, b.z - KINGS_ROAD[i]!.z),
}));
const length = segments.reduce((sum, s) => sum + s.length, 0);
export function kingsRoadAt(
  x: number,
  z: number,
): { distance: number; progress: number; halfWidth: number } | null {
  if (x < 181 || x > 236 || z < 155 || z > 200) return null;
  let distance = 8,
    progress = 0,
    travelled = 0;
  for (const { a, b, length: span } of segments) {
    const dx = b.x - a.x,
      dz = b.z - a.z;
    const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (span * span)));
    const d = Math.hypot(x - a.x - dx * t, z - a.z - dz * t);
    if (d < distance) {
      distance = d;
      progress = (travelled + span * t) / length;
    }
    travelled += span;
  }
  if (distance >= 8) return null;
  return {
    distance,
    progress,
    halfWidth: 1.65 + 0.2 * Math.sin(progress * 12) + 2 * smoothstep(progress, 0.85, 1),
  };
}
export function kingsRoadCoverage(x: number, z: number): number {
  const road = kingsRoadAt(x, z);
  return road
    ? 1 -
        smoothstep(
          road.distance + Math.sin(x * 1.3 + z * 0.8) * 0.13,
          road.halfWidth - 0.5,
          road.halfWidth + 0.8,
        )
    : 0;
}
export function kingsRoadHeight(
  x: number,
  z: number,
  ground: number,
  start: number,
  end: number,
): number {
  const road = kingsRoadAt(x, z);
  if (!road) return ground;
  const townEdge = Math.max(Math.abs(x - SKELETON_TOWN.x), Math.abs(z - SKELETON_TOWN.z));
  const weight =
    (1 - smoothstep(road.distance, road.halfWidth, road.halfWidth + 3)) *
    smoothstep(townEdge, 30, 40);
  const level = lerp(start, end, road.progress) + Math.sin(road.progress * Math.PI) * 0.8;
  return lerp(ground, level, weight);
}
export function kingsRoadBeat(x: number, z: number): { title: string; detail: string } | null {
  const road = kingsRoadAt(x, z);
  if (!road || road.distance > 7) return null;
  if (road.progress < 0.32)
    return {
      title: 'The King’s Road',
      detail: 'The watch abandoned this road. Their scouts did not.',
    };
  if (road.progress < 0.72)
    return {
      title: 'The Broken Watch',
      detail: 'Clear the ruined watchposts. Beyond them waits their king.',
    };
  return {
    title: 'The Last Muster',
    detail: 'Gather your allies and prepare. The Hollow King waits ahead.',
  };
}

export function blocksKingsRoad(x: number, z: number, radius: number): boolean {
  const road = kingsRoadAt(x, z);
  return road !== null && road.distance < road.halfWidth + 1.2 + radius;
}
