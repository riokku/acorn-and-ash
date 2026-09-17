const TAU = Math.PI * 2;

export { TAU };

/** Fold an angle into (-PI, PI]. */
export function wrapAngle(radians: number): number {
  let angle = radians % TAU;
  if (angle > Math.PI) angle -= TAU;
  if (angle <= -Math.PI) angle += TAU;
  return angle;
}

/** The shortest way round from one angle to another. */
export function angleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

/** Rotate `from` toward `to` by at most `maxDelta` radians, the short way round. */
export function rotateToward(from: number, to: number, maxDelta: number): number {
  const delta = angleDelta(from, to);
  if (Math.abs(delta) <= maxDelta) return wrapAngle(to);
  return wrapAngle(from + Math.sign(delta) * maxDelta);
}

/** Blend between two angles the short way round. */
export function lerpAngle(from: number, to: number, alpha: number): number {
  return wrapAngle(from + angleDelta(from, to) * alpha);
}
