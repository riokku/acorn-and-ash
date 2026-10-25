import * as THREE from 'three/webgpu';
import { uniform, sin } from 'three/tsl';

/** One world-space breeze: no camera/player offset and no per-object timers. */
export const forestWind = {
  seconds: uniform(0),
  strength: uniform(0),
  direction: uniform(new THREE.Vector2(1, 0.45).normalize()),
};

export function advanceForestWind(
  delta: number,
  weatherWind: number,
  reducedMotion: boolean,
): void {
  const dt = Number.isFinite(delta) ? Math.max(0, Math.min(0.1, delta)) : 0;
  const target = reducedMotion ? 0 : Math.max(0, Math.min(1, weatherWind));
  if (reducedMotion) forestWind.strength.value = 0;
  else
    forestWind.strength.value += (target - forestWind.strength.value) * (1 - Math.exp(-dt * 0.8));
  if (!reducedMotion) forestWind.seconds.value += dt;
}

/** Slow traveling gusts; the same expression is used by GPU vegetation. */
export function windGustAt(x: number, z: number): number {
  return (
    (0.65 + Math.sin(x * 0.11 + z * 0.08 - forestWind.seconds.value * 0.9) * 0.35) *
    forestWind.strength.value
  );
}

export function windGustNode(point: THREE.Node<'vec2'>): THREE.Node<'float'> {
  return sin(point.x.mul(0.11).add(point.y.mul(0.08)).sub(forestWind.seconds.mul(0.9)))
    .mul(0.35)
    .add(0.65)
    .mul(forestWind.strength);
}
