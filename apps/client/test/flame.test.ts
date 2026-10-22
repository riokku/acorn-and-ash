import * as THREE from 'three/webgpu';
import { afterEach, expect, it, vi } from 'vitest';
import { flameModelTemplate, campfireModelParts } from '../src/scene/campfire-models';
import { createFlame } from '../src/scene/flame';
import { createCampfire } from '../src/scene/campfire';

vi.mock('../src/scene/campfire-models', () => ({
  flameModelTemplate: vi.fn(),
  campfireModelParts: vi.fn(),
}));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function template() {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh<THREE.BufferGeometry, THREE.Material>(
    new THREE.BoxGeometry(),
    new THREE.MeshBasicMaterial(),
  );
  mesh.name = 'fire';
  root.add(mesh);
  vi.mocked(flameModelTemplate).mockReturnValue({
    root,
    clips: [
      new THREE.AnimationClip('curl', 6, [
        new THREE.NumberKeyframeTrack('fire.scale[y]', [0, 3, 6], [1, 2, 1]),
      ]),
    ],
  });
  vi.mocked(campfireModelParts).mockReturnValue(undefined);
  return mesh;
}
it('staggered fires animate independently, freeze for accessibility, and bound resumed frames', () => {
  template();
  const preference = { matches: false };
  vi.stubGlobal('matchMedia', () => preference);
  const a = createFlame()!,
    b = createFlame()!;
  const ma = a.root.getObjectByName('fire')!,
    mb = b.root.getObjectByName('fire')!;
  expect(ma.scale.y).not.toBe(mb.scale.y);
  const before = ma.scale.y,
    other = mb.scale.y;
  a.update(60);
  expect(Math.abs(ma.scale.y - before)).toBeLessThanOrEqual(0.1 / 3 + 0.000001);
  expect(mb.scale.y).toBe(other);
  const resumed = ma.scale.y;
  for (const dt of [-1, NaN, Infinity]) a.update(dt);
  expect(ma.scale.y).toBe(resumed);
  preference.matches = true;
  a.update(0.1);
  expect(ma.scale.y).toBe(resumed);
  preference.matches = false;
  a.update(0.1);
  expect(ma.scale.y).not.toBe(resumed);
  a.dispose();
  b.dispose();
});
it('relighting reuses the prepared flame without cloning or disposing shared art', () => {
  const mesh = template();
  const geometry = vi.spyOn(mesh.geometry, 'dispose');
  const material = vi.spyOn(mesh.material, 'dispose');
  const fire = createCampfire();
  fire.setLit(true);
  const old = fire.group.getObjectByName('fire')!;
  expect(old).toBeDefined();
  fire.setLit(false);
  expect(fire.group.getObjectByName('fire')).toBe(old);
  expect(old.parent?.visible).toBe(false);
  fire.setLit(true);
  expect(fire.group.getObjectByName('fire')).toBe(old);
  expect(old.parent?.visible).toBe(true);
  fire.dispose();
  expect(fire.group.getObjectByName('fire')).toBeUndefined();
  expect(geometry).not.toHaveBeenCalled();
  expect(material).not.toHaveBeenCalled();
});

it('softens wildfire instances without changing or disposing the shared campfire flame', () => {
  const mesh = template();
  const source = new THREE.MeshStandardMaterial({
    color: 0xff9900,
    emissive: 0xff4400,
    emissiveIntensity: 1.6,
  });
  mesh.material = source;
  const sourceDispose = vi.spyOn(source, 'dispose');
  const soft = createFlame({ softBase: true })!;
  const ordinary = createFlame()!;
  const material = (soft.root.getObjectByName('fire') as THREE.Mesh)
    .material as THREE.MeshStandardNodeMaterial;
  expect(material).not.toBe(source);
  expect(material.opacityNode).not.toBeNull();
  expect(material.transparent).toBe(true);
  expect(material.depthWrite).toBe(false);
  expect(material.emissiveIntensity).toBe(source.emissiveIntensity);
  expect(material.color.equals(source.color)).toBe(true);
  expect((ordinary.root.getObjectByName('fire') as THREE.Mesh).material).toBe(source);
  expect(source.transparent).toBe(false);
  expect(source.depthWrite).toBe(true);
  const ownedDispose = vi.spyOn(material, 'dispose');
  soft.dispose();
  soft.dispose();
  ordinary.dispose();
  expect(ownedDispose).toHaveBeenCalledTimes(1);
  expect(sourceDispose).not.toHaveBeenCalled();
});
