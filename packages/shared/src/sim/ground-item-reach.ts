import { PICKUP_REACH } from '../constants';
import type { CollisionWorld } from '../collision/capsule';
import type { Vec3 } from '../math/vec3';
import { voxelIndex } from '../world/digging';

/** Preserve horizontal pickup reach, but do not reach through a bank or another floor. */
export function groundItemReachable(
  world: Pick<CollisionWorld, 'terrain' | 'dug'>,
  position: Readonly<Vec3>,
  target: { readonly x: number; readonly z: number },
  heightOffset = 0,
): boolean {
  const dx = target.x - position.x;
  const dz = target.z - position.z;
  if (dx * dx + dz * dz > PICKUP_REACH * PICKUP_REACH) return false;
  const targetY = world.terrain.heightAt(target.x, target.z) + heightOffset;
  if (!Number.isFinite(targetY) || Math.abs(targetY - position.y) > PICKUP_REACH) return false;
  const handY = position.y + 1;
  for (let step = 1; step < 8; step++) {
    const fraction = step / 8;
    const x = position.x + dx * fraction;
    const z = position.z + dz * fraction;
    const y = handY + (targetY + 0.2 - handY) * fraction;
    const surface = world.terrain.heightAt(x, z);
    if (!Number.isFinite(surface)) return false;
    if (y >= surface - 0.05) continue;
    if (!world.dug?.isDug(voxelIndex(x), voxelIndex(y), voxelIndex(z))) return false;
  }
  return true;
}
