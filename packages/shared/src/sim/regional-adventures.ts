import { LAKE, basinDepthAt } from '../world/lake';
import { STREAM, streamPointAt } from '../world/stream';

/** Generous landward margins let an arrival count from a safe bank or trail. */
export function nearAdventureLake(x: number, z: number): boolean {
  return basinDepthAt(LAKE, x, z) >= -8;
}
export function nearMountainSpring(x: number, z: number): boolean {
  const source = streamPointAt(STREAM, 0);
  return Math.hypot(x - source.x, z - source.z) <= 14;
}
