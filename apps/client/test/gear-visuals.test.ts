import * as THREE from 'three/webgpu';
import { beforeEach, expect, it, vi } from 'vitest';
import { GEAR_ITEMS, canWearIn } from '@acorn/shared';
vi.mock('../src/scene/worn-gear-models', () => ({
  wornGearModelTemplate: vi.fn(),
}));
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
it('draws every helm from its fitted file on a soft body, following the head through swaps', () => {
  const helms = GEAR_ITEMS.filter((item) => canWearIn(item, 'helm'));
  expect(helms).toEqual(expect.arrayContaining(['woolCap', 'watchCaptainHelm', 'kingCrown']));
  const root = new THREE.Group();
  const body = part('body1_1');
  root.add(body.mesh, body.bone);
  const hat = part('hat');
  const source = new THREE.Group();
  source.add(hat.mesh);
  vi.mocked(wornGearModelTemplate).mockReturnValue({ root: source, clips: [] });
  const visuals = createGearVisuals(root, undefined, 1, { bodyFitted: false });
  for (const helm of helms) {
    visuals.setWorn({ helm });
    const worn = extraMeshes(root, [body.mesh]);
    expect(worn, helm).toHaveLength(1);
    expect(worn[0]!.userData.gearItem).toBe(helm);
    expect(worn[0]!.skeleton.bones[0]).toBe(body.bone);
    expect(vi.mocked(wornGearModelTemplate)).toHaveBeenLastCalledWith(helm);
  }
  const point = new THREE.Vector3();
  const [worn] = extraMeshes(root, [body.mesh]);
  root.updateMatrixWorld(true);
  worn!.skeleton.update();
  worn!.getVertexPosition(0, point);
  const before = point.clone();
  body.bone.position.x += 0.3;
  root.updateMatrixWorld(true);
  worn!.skeleton.update();
  worn!.getVertexPosition(0, point);
  expect(point.x - before.x).toBeCloseTo(0.3);
  visuals.setWorn({});
  expect(extraMeshes(root, [body.mesh])).toHaveLength(0);
});
it('holds a knife worn in the off hand, on every body, and puts it away when taken off', () => {
  const root = new THREE.Group();
  const body = part('body1_1');
  const hand = new THREE.Bone();
  root.add(body.mesh, body.bone, hand);
  const visuals = createGearVisuals(root, hand, 1, { bodyFitted: false });
  visuals.setWorn({ offHand: 'huntingKnife' });
  expect(hand.children).toHaveLength(1);
  expect(hand.children[0]!.children.length).toBeGreaterThan(0);
  expect(hand.children[0]!.children[0]!.userData.gearItem).toBe('huntingKnife');
  visuals.setWorn({ offHand: 'woodenShield' });
  expect(hand.children).toHaveLength(1);
  expect(hand.children[0]!.userData.gearItem).toBe('woodenShield');
  visuals.setWorn({});
  expect(hand.children).toHaveLength(0);
});
it.each([
  ['body1', 'body1002_0'],
  ['body2', 'body2_0'],
])('draws only %s’s fit of every top, and no clothes it has no file for', (wearer, meshName) => {
  const tops = GEAR_ITEMS.filter((item) => canWearIn(item, 'upperBody'));
  expect(tops).toEqual(
    expect.arrayContaining(['travelerTunic', 'linenShirt', 'winterJacket', 'cedarstalkerCoat']),
  );
  const root = new THREE.Group();
  const holder = new THREE.Group();
  holder.name = wearer;
  const body = part(meshName);
  holder.add(body.mesh);
  root.add(holder, body.bone);
  const source = new THREE.Group();
  const fits = new Map<string, THREE.SkinnedMesh[]>();
  for (const fit of ['body1', 'body2']) {
    const group = new THREE.Group();
    group.name = `linen_shirt_${fit}`;
    const pieces = [part(`${group.name}_0`).mesh, part(`${group.name}_1`).mesh];
    group.add(...pieces);
    source.add(group);
    fits.set(fit, pieces);
  }
  vi.mocked(wornGearModelTemplate).mockImplementation((item) =>
    tops.includes(item) ? { root: source, clips: [] } : undefined,
  );
  const visuals = createGearVisuals(root, undefined, 1, { bodyFitted: false });
  for (const top of tops) {
    visuals.setWorn({ upperBody: top, lowerBody: 'workTrousers' });
    const worn = extraMeshes(root, [body.mesh]);
    expect(worn, top).toHaveLength(2);
    expect(worn.map((mesh) => mesh.geometry)).toEqual(
      fits.get(wearer)!.map((piece) => piece.geometry),
    );
    expect(worn[0]!.skeleton.bones[0]).toBe(body.bone);
  }
  visuals.setWorn({});
  expect(extraMeshes(root, [body.mesh])).toHaveLength(0);
});
it('leaves clothes off a body they were not made for, but still hangs the shield', () => {
  const root = new THREE.Group();
  const body = part('dwarf1_Body');
  const hand = new THREE.Bone();
  root.add(body.mesh, body.bone, hand);
  const visuals = createGearVisuals(root, hand, 1, { bodyFitted: false });
  visuals.setWorn({
    upperBody: 'winterJacket',
    lowerBody: 'workTrousers',
    offHand: 'woodenShield',
  });
  expect(extraMeshes(root, [body.mesh])).toHaveLength(0);
  expect(hand.children).toHaveLength(1);
  visuals.dispose();
  expect(hand.children).toHaveLength(0);
});
