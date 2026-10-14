import * as THREE from 'three/webgpu';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/scene/worn-gear-models', () => ({ wornGearModelTemplate: vi.fn() }));
import { wornGearModelTemplate } from '../src/scene/worn-gear-models';
import { createGearVisuals } from '../src/scene/gear-visuals';

function part(name: string, x = 0.2, bone = new THREE.Bone()) {
  bone.name = 'Head';
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([x, 1, 0, x + 0.01, 1.1, 0, x, 1.2, 0.1], 3),
  );
  geometry.computeVertexNormals();
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(12).fill(0), 4));
  geometry.setAttribute(
    'skinWeight',
    new THREE.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4),
  );
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial());
  mesh.name = name;
  mesh.bind(new THREE.Skeleton([bone]));
  return { mesh, bone };
}
function extraMeshes(
  root: THREE.Object3D,
  originals: readonly THREE.SkinnedMesh[],
): THREE.SkinnedMesh[] {
  const meshes: THREE.SkinnedMesh[] = [];
  root.traverse((object) => {
    if (object instanceof THREE.SkinnedMesh && !originals.includes(object)) meshes.push(object);
  });
  return meshes;
}
beforeEach(() => vi.mocked(wornGearModelTemplate).mockReturnValue(undefined));
it('binds a separately exported hat to the wearer and removes it when taken off', () => {
  const root = new THREE.Group(),
    own = part('Ranger_Body'),
    hat = part('barbarian_bear_hat');
  root.add(own.mesh, own.bone);
  const source = new THREE.Group();
  source.add(hat.mesh);
  vi.mocked(wornGearModelTemplate).mockReturnValue({ root: source, clips: [] });
  const visuals = createGearVisuals(root, undefined, 1);
  visuals.setWorn({ helm: 'bearHat' });
  const attached = extraMeshes(root, [own.mesh]);
  expect(attached).toHaveLength(1);
  expect(attached[0]!.skeleton.bones[0]).toBe(own.bone);
  expect(attached[0]!.skeleton.bones[0]).not.toBe(hat.bone);
  visuals.setWorn({});
  expect(extraMeshes(root, [own.mesh])).toHaveLength(0);
});
it('covers sleeves and hands in the multipart meshes exported by glTF', () => {
  const root = new THREE.Group(),
    sleeve = part('Ranger_ArmLeft_1'),
    hand = part('Ranger_ArmLeft_2', 0.9);
  root.add(sleeve.mesh, hand.mesh);
  const visuals = createGearVisuals(root, undefined, 1);
  visuals.setWorn({ upperBody: 'winterJacket', hands: 'leatherGloves' });
  expect(extraMeshes(root, [sleeve.mesh, hand.mesh])).toHaveLength(2);
  visuals.dispose();
  expect(extraMeshes(root, [sleeve.mesh, hand.mesh])).toHaveLength(0);
});
