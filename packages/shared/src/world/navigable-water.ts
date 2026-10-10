/** Connected water used by hulls, building, boarding and landing. Depth here is distance from shore, like lakeDepthAt. */
import { LAKE, lakeSlopeAt, lakeDepthAt, type LakeSlope } from './lake';
import {
  STREAM,
  nearestOnStream,
  signedStreamAcross,
  sloughSurfaceAt,
  streamSurfaceAt,
  streamWaterHalfWidthAt,
} from './stream';

export function navigableWaterSlopeAt(x: number, z: number, out: LakeSlope): LakeSlope {
  lakeSlopeAt(LAKE, x, z, out);
  const spot = nearestOnStream(STREAM, x, z, 12);
  if (spot !== null) {
    const depth = streamWaterHalfWidthAt(STREAM, spot.along) - spot.distance;
    if (depth > out.depth) {
      const side = signedStreamAcross(STREAM, spot, x, z) >= 0 ? 1 : -1;
      // At the centre use the local perpendicular, rather than a zero gradient.
      const row = Math.round(spot.along / (STREAM.length / (STREAM.count - 1)));
      const before = Math.max(0, row - 1),
        after = Math.min(STREAM.count - 1, row + 1);
      const dx = STREAM.points[after * 2]! - STREAM.points[before * 2]!;
      const dz = STREAM.points[after * 2 + 1]! - STREAM.points[before * 2 + 1]!;
      const size = Math.hypot(dx, dz) || 1;
      out.depth = depth;
      out.towardX = (dz / size) * side;
      out.towardZ = (-dx / size) * side;
    }
  }
  for (const slough of STREAM.sloughs) {
    const slope = lakeSlopeAt(slough, x, z, { depth: 0, towardX: 0, towardZ: 0 });
    if (slope.depth > out.depth) Object.assign(out, slope);
  }
  return out;
}

export function navigableWaterDepthAt(x: number, z: number): number {
  return navigableWaterSlopeAt(x, z, { depth: 0, towardX: 0, towardZ: 0 }).depth;
}

/** Surface height at a floating object, including the grade through each slough. */
export function navigableWaterSurfaceAt(x: number, z: number): number {
  const spot = nearestOnStream(STREAM, x, z, 8);
  if (spot !== null && spot.distance <= streamWaterHalfWidthAt(STREAM, spot.along))
    return streamSurfaceAt(STREAM, spot.along);
  for (const slough of STREAM.sloughs) {
    if (lakeDepthAt(slough, x, z) > 0) return sloughSurfaceAt(STREAM, slough, x, z);
  }
  return LAKE.level;
}
