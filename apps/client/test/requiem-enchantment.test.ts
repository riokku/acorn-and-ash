import * as THREE from 'three/webgpu';
import { expect, it, vi } from 'vitest';
import { raiderWeapon } from '../src/scene/raider-weapons';
import { wornWeapon } from '../src/scene/gear-models';
import { createPileModel } from '../src/scene/ground-items';
import { createItemModel } from '../src/admin/item-model';

it('shares the existing blade geometry without repainting normal watch weapons or changing their reach', () => {
  const normal = raiderWeapon('sentinel');
  const colors = normal.parts.map((p) => (p.material as THREE.MeshStandardMaterial).color.getHex());
  const king = raiderWeapon('hollowKing');
  expect(king.length).toBe(normal.length);
  expect(king.parts.filter((p) => !p.effect).map((p) => p.geometry)).toEqual(
    normal.parts.map((p) => p.geometry),
  );
  expect(
    normal.parts.map((p) => (p.material as THREE.MeshStandardMaterial).color.getHex()),
  ).toEqual(colors);
  expect(wornWeapon('kingsRequiem')).toBe(king);
  expect(wornWeapon('watchGreatsword')).toBe(normal);
  const pile = createPileModel('kingsRequiem');
  const normalPile = createPileModel('watchGreatsword');
  try {
    // Shader particles must not lift a physical sword off the ground.
    expect(pile.group.children.map((mesh) => mesh.position.y)).toEqual(
      pile.group.children.map(() => normalPile.group.children[0]!.position.y),
    );
  } finally {
    pile.dispose();
    normalPile.dispose();
  }
});
it('keeps animated admin previews independent of shared game materials and geometry', async () => {
  const shared = wornWeapon('kingsRequiem')!;
  const disposed = vi.fn();
  for (const part of shared.parts) {
    part.geometry.addEventListener('dispose', disposed);
    part.material.addEventListener('dispose', disposed);
  }
  const preview = await createItemModel('kingsRequiem');
  expect(preview.animated).toBe(true);
  const meshes = preview.group.children as THREE.Mesh[];
  expect(meshes.some((m) => m.material instanceof THREE.MeshBasicNodeMaterial)).toBe(true);
  expect(
    meshes.every(
      (m) => !shared.parts.some((p) => p.geometry === m.geometry || p.material === m.material),
    ),
  ).toBe(true);
  preview.dispose();
  expect(disposed).not.toHaveBeenCalled();
  for (const part of shared.parts) {
    part.geometry.removeEventListener('dispose', disposed);
    part.material.removeEventListener('dispose', disposed);
  }
  expect(shared.parts.every((p) => p.geometry.getAttribute('position').count > 0)).toBe(true);
});
