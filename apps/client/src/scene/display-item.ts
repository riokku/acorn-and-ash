import * as THREE from 'three/webgpu';
import { toolKind, type ItemId } from '@acorn/shared';
import { itemModelParts } from './item-models';
import { wornWeapon } from './gear-models';

/** Repositions existing item assets; shared geometry and materials remain owned by their caches. */
export function createDisplayTool(item: ItemId | null): THREE.Group {
  const group = new THREE.Group();
  group.name = 'display-tool';
  if (item === null) return group;
  const tool = toolKind(item);
  const parts =
    tool === 'axe' || tool === 'rod' || tool === 'shovel'
      ? itemModelParts(tool)
      : wornWeapon(item)?.parts;
  for (const part of parts ?? []) {
    if (part.effect) continue;
    group.add(new THREE.Mesh(part.geometry, part.material));
  }
  if (group.children.length === 0) return group;
  group.rotation.set(Math.PI / 2, 0, -0.35);
  group.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(group),
    size = box.getSize(new THREE.Vector3());
  const scale = Math.min(1, 0.72 / Math.max(size.x, size.z), 0.22 / Math.max(size.y, 0.001));
  group.scale.setScalar(scale);
  group.position.set(
    (-(box.min.x + box.max.x) / 2) * scale,
    -box.min.y * scale,
    (-(box.min.z + box.max.z) / 2) * scale,
  );
  return group;
}
