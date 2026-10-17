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
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
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
it('relighting a campfire releases its old flame without disposing shared art', () => {
  const mesh = template();
  const geometry = vi.spyOn(mesh.geometry, 'dispose');
  const material = vi.spyOn(mesh.material, 'dispose');
  const fire = createCampfire();
  fire.setLit(true);
  const old = fire.group.getObjectByName('fire')!;
  expect(old).toBeDefined();
  fire.setLit(false);
  expect(fire.group.getObjectByName('fire')).toBeUndefined();
  fire.setLit(true);
  expect(fire.group.getObjectByName('fire')).not.toBe(old);
  fire.dispose();
  expect(fire.group.getObjectByName('fire')).toBeUndefined();
  expect(geometry).not.toHaveBeenCalled();
  expect(material).not.toHaveBeenCalled();
});
