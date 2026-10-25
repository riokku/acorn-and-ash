import * as THREE from 'three/webgpu';
import { expect, it, vi } from 'vitest';
import { KingVictoryEffect, KING_VICTORY_SECONDS } from '../src/scene/king-victory';
import { wornWeapon } from '../src/scene/gear-models';
import { rehearseEffects } from '../src/scene/effect-rehearsal';

it('rehearses, replays and expires without disposing the live shared enchanted weapon', () => {
  const weapon = wornWeapon('kingsRequiem')!,
    disposed = vi.fn();
  for (const part of weapon.parts) {
    part.geometry.addEventListener('dispose', disposed);
    part.material.addEventListener('dispose', disposed);
  }
  const effect = new KingVictoryEffect(),
    scene = new THREE.Group();
  scene.add(effect.group);
  expect(effect.group.visible).toBe(false);
  rehearseEffects([effect.group], () =>
    expect(effect.group.children.every((child) => child.visible)).toBe(true),
  );
  expect(effect.group.visible).toBe(false);
  effect.start({ x: 10, y: 2, z: 30 });
  effect.update(4.8);
  expect(effect.group.position.toArray()).toEqual([10, 2, 30]);
  const blade = effect.group.children.find((child) => child instanceof THREE.Group)!;
  expect(blade.visible).toBe(true);
  expect((blade.children[0] as THREE.Mesh).geometry).toBe(weapon.parts[0]!.geometry);
  effect.update(KING_VICTORY_SECONDS);
  expect(effect.group.visible).toBe(false);
  effect.start({ x: 1, y: 0, z: 2 });
  expect(effect.group.visible).toBe(true);
  effect.clear();
  expect(effect.group.visible).toBe(false);
  effect.dispose();
  expect(scene.children).toHaveLength(0);
  expect(disposed).not.toHaveBeenCalled();
  for (const part of weapon.parts) {
    part.geometry.removeEventListener('dispose', disposed);
    part.material.removeEventListener('dispose', disposed);
  }
});
it('keeps the reduced-motion particles stationary and omits moving soul ribbons', () => {
  const effect = new KingVictoryEffect();
  try {
    effect.start({ x: 0, y: 0, z: 0 }, true);
    effect.update(4);
    const sparks = effect.group.children.find(
      (child) => child instanceof THREE.InstancedMesh,
    ) as THREE.InstancedMesh;
    expect(sparks.count).toBe(8);
    const before = Array.from(sparks.instanceMatrix.array);
    effect.update(5);
    expect(Array.from(sparks.instanceMatrix.array)).toEqual(before);
    const ribbons = effect.group.children.filter(
      (child) =>
        child instanceof THREE.Mesh && child.material instanceof THREE.MeshBasicNodeMaterial,
    );
    expect(ribbons.length).toBe(3);
    expect(ribbons.every((child) => !child.visible)).toBe(true);
  } finally {
    effect.dispose();
  }
});
