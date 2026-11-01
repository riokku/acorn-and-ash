import * as THREE from 'three/webgpu';
import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('../src/scene/worn-gear-models', () => ({
  wornGearModelTemplate: vi.fn(),
  createWatchCaptainHelm: vi.fn(),
}));
import { wornGearModelTemplate, createWatchCaptainHelm } from '../src/scene/worn-gear-models';
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
it('fits a low-poly cap to the head and keeps it attached through animation and repeated swaps', () => {
  const root = new THREE.Group();
  const head = part('Ranger_Head');
  root.add(head.mesh, head.bone);
  const visuals = createGearVisuals(root, undefined, 1);
  visuals.setWorn({ helm: 'woolCap' });
  const cap = extraMeshes(root, [head.mesh]);
  expect(cap).toHaveLength(2);
  expect(cap.every((mesh) => mesh.skeleton === head.mesh.skeleton && !mesh.frustumCulled)).toBe(
    true,
  );
  const point = new THREE.Vector3();
  cap[0]!.updateMatrixWorld(true);
  head.bone.updateMatrixWorld(true);
  head.mesh.skeleton.update();
  cap[0]!.getVertexPosition(0, point);
  const before = point.clone();
  head.bone.position.x += 0.3;
  head.bone.updateMatrixWorld(true);
  head.mesh.skeleton.update();
  cap[0]!.getVertexPosition(0, point);
  expect(point.x - before.x).toBeCloseTo(0.3);
  const triangles = cap.reduce(
    (sum, mesh) =>
      sum + (mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3,
    0,
  );
  expect(triangles).toBeLessThan(2000);
  visuals.setWorn({});
  expect(extraMeshes(root, [head.mesh])).toHaveLength(0);
  visuals.setWorn({ helm: 'woolCap' });
  expect(extraMeshes(root, [head.mesh])).toHaveLength(2);
  visuals.dispose();
  expect(extraMeshes(root, [head.mesh])).toHaveLength(0);
});

it('attaches the Last Watch helm to the animated head without disposing shared assets', () => {
  const root = new THREE.Group();
  const head = new THREE.Bone();
  head.name = 'head';
  root.add(head);
  const helm = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshStandardMaterial();
  helm.add(new THREE.Mesh(geometry, material));
  const disposeGeometry = vi.spyOn(geometry, 'dispose');
  const disposeMaterial = vi.spyOn(material, 'dispose');
  vi.mocked(createWatchCaptainHelm).mockReturnValue(helm);
  const visuals = createGearVisuals(root, undefined, 1);
  visuals.setWorn({ helm: 'watchCaptainHelm' });
  expect(helm.parent).toBe(head);
  expect(helm.children[0]!.userData.gearItem).toBe('watchCaptainHelm');
  head.position.x = 2;
  root.updateMatrixWorld(true);
  expect(helm.getWorldPosition(new THREE.Vector3()).x).toBe(2);
  visuals.setWorn({});
  expect(helm.parent).toBeNull();
  visuals.dispose();
  expect(disposeGeometry).not.toHaveBeenCalled();
  expect(disposeMaterial).not.toHaveBeenCalled();
});
it('leaves helms and clothes off a body they were not made for, but still hangs the shield', () => {
  const root = new THREE.Group();
  const body = part('dwarf1_Body');
  const hand = new THREE.Bone();
  root.add(body.mesh, body.bone, hand);
  const visuals = createGearVisuals(root, hand, 1, { bodyFitted: false });
  visuals.setWorn({ helm: 'woolCap', upperBody: 'winterJacket', offHand: 'woodenShield' });
  expect(extraMeshes(root, [body.mesh])).toHaveLength(0);
  expect(hand.children).toHaveLength(1);
  visuals.dispose();
  expect(hand.children).toHaveLength(0);
});
