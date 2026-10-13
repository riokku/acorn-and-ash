import * as THREE from 'three/webgpu';
import { afterEach, expect, it, vi } from 'vitest';
import { flameModelTemplate } from '../src/scene/campfire-models';
import { createTorchFlame } from '../src/scene/torch-flame';
vi.mock('../src/scene/campfire-models', () => ({ flameModelTemplate: vi.fn() }));
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function template() {
  const root = new THREE.Group();
  const fire = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  fire.name = 'fire';
  root.add(fire);
  vi.mocked(flameModelTemplate).mockReturnValue({
    root,
    clips: [
      new THREE.AnimationClip('flicker', 1, [
        new THREE.NumberKeyframeTrack('fire.scale[y]', [0, 1], [1, 2]),
      ]),
    ],
  });
  return fire;
}
it('follows a rotated moving wick while the flame rises upright', () => {
  template();
  const effect = createTorchFlame()!;
  const hand = new THREE.Group();
  hand.rotation.set(0.7, 1.2, -1);
  hand.position.set(2, 3, 4);
  const wick = new THREE.Group();
  wick.position.y = 0.72;
  hand.add(wick);
  wick.add(effect.group);
  for (const angle of [0, 0.5, 2]) {
    hand.rotation.z = angle;
    hand.position.x += 1;
    effect.update(0.05, true);
    expect(
      effect.group
        .getWorldPosition(new THREE.Vector3())
        .distanceTo(wick.getWorldPosition(new THREE.Vector3())),
    ).toBeLessThan(0.00001);
    expect(
      effect.group.getWorldQuaternion(new THREE.Quaternion()).angleTo(new THREE.Quaternion()),
    ).toBeLessThan(0.00001);
  }
  expect(effect.group.scale.x).toBe(0.72);
  effect.dispose();
});
it('animates only a visible torch and pauses the flame for reduced motion', () => {
  template();
  const preference = { matches: false };
  vi.stubGlobal('matchMedia', () => preference);
  const effect = createTorchFlame()!;
  const fire = effect.group.getObjectByName('fire')!;
  const start = fire.scale.y;
  effect.update(0.05, true);
  expect(fire.scale.y).not.toBe(start);
  const playing = fire.scale.y;
  effect.update(0.05, false);
  expect(fire.scale.y).toBe(playing);
  expect(effect.group.visible).toBe(false);
  preference.matches = true;
  effect.update(0.05, true);
  expect(fire.scale.y).toBe(playing);
  expect(effect.group.visible).toBe(true);
  effect.dispose();
});
it('releases its animated copy without disposing shared flame resources', () => {
  const source = template();
  const geometry = vi.spyOn(source.geometry, 'dispose');
  const material = vi.spyOn(source.material as THREE.Material, 'dispose');
  const effect = createTorchFlame()!;
  const wick = new THREE.Group();
  wick.add(effect.group);
  effect.dispose();
  expect(effect.group.parent).toBe(null);
  expect(geometry).not.toHaveBeenCalled();
  expect(material).not.toHaveBeenCalled();
});
it('keeps the existing torch glow as a fallback if the flame asset is unavailable', () => {
  vi.mocked(flameModelTemplate).mockReturnValue(undefined);
  expect(createTorchFlame()).toBe(null);
});
