import * as THREE from 'three/webgpu';
import { expect, it, vi } from 'vitest';
import { animateSmallAnimal } from '../src/scene/animal-motion';

function animal(kind: 'rabbit' | 'maskedRaccoon' | 'fox' | 'coyote', phaseSeed = 0) {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.6), new THREE.MeshBasicMaterial());
  mesh.position.y = 0.15;
  group.add(mesh);
  const dispose = vi.fn(() => {
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  });
  return { model: animateSmallAnimal({ group, dispose }, kind, phaseSeed), mesh, dispose };
}

it.each(['rabbit', 'maskedRaccoon', 'fox', 'coyote'] as const)(
  'keeps %s movement animation frame-rate independent',
  (kind) => {
    const poses = [30, 60, 144].map((fps) => {
      const { model } = animal(kind);
      for (let frame = 0; frame < fps * 2; frame++)
        model.update(1 / fps, { speed: frame < fps ? 2 : 0, alert: true });
      const child = model.group.children[0]!;
      child.updateMatrix();
      const matrix = child.matrix.elements.slice();
      model.dispose();
      return matrix;
    });
    for (const pose of poses)
      pose.forEach((value, i) => expect(value).toBeCloseTo(poses[1]![i]!, 5));
  },
);

it.each(['rabbit', 'maskedRaccoon', 'fox', 'coyote'] as const)(
  'animates %s while preserving its world position and settling softly to idle',
  (kind) => {
    const { model, mesh, dispose } = animal(kind);
    model.group.position.set(10, 2, 3);
    const heights = [];
    for (let frame = 0; frame < 60; frame++) {
      model.update(1 / 60, { speed: 3 });
      heights.push(model.group.children[0]!.position.y);
    }
    expect(Math.max(...heights)).toBeGreaterThan(0.01);
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(0);
    expect(model.group.position.toArray()).toEqual([10, 2, 3]);
    for (let frame = 0; frame < 120; frame++) model.update(1 / 60, { speed: 0 });
    const motion = model.group.children[0]!;
    expect(motion.position.y).toBeLessThan(0.00001);
    expect(Math.abs(motion.rotation.x)).toBeLessThan(0.00001);
    expect(mesh.position.y).toBe(0.15);
    expect(mesh.parent).toBe(motion);
    model.dispose();
    expect(dispose).toHaveBeenCalledOnce();
  },
);

it('stagger small-animal motion by identity instead of making a group hop together', () => {
  const animals = [1, 2].map((seed) => animal('rabbit', seed));
  animals.forEach(({ model }) => model.update(0.1, { speed: 2 }));
  expect(animals[0]!.model.group.children[0]!.position.y).not.toBeCloseTo(
    animals[1]!.model.group.children[0]!.position.y,
    5,
  );
  animals.forEach(({ model }) => model.dispose());
});

it('crouches and bites smoothly without moving the coyote’s world root, then settles after recovery', () => {
  const { model } = animal('coyote');
  model.group.position.set(12, 3, -8);
  for (let i = 0; i < 60; i++) model.update(1 / 60, { speed: 0, windup: true });
  const motion = model.group.children[0]!;
  expect(motion.scale.y).toBeLessThan(0.9);
  for (let i = 0; i < 15; i++) model.update(1 / 60, { speed: 0, attacking: true });
  expect(motion.position.z).toBeLessThan(-0.1);
  expect(model.group.position.toArray()).toEqual([12, 3, -8]);
  for (let i = 0; i < 180; i++) model.update(1 / 60, { speed: 0 });
  expect(Math.abs(motion.position.z)).toBeLessThan(0.00001);
  expect(Math.abs(motion.rotation.x)).toBeLessThan(0.00001);
  model.dispose();
});

it('fits a small creature to sloping ground without translating its root or sampling every frame', () => {
  const { model } = animal('coyote');
  model.group.position.set(4, 2, -6);
  const groundHeight = vi.fn((x: number, z: number) => x * 0.2 + z * 0.3);
  for (let frame = 0; frame < 120; frame++) model.update(1 / 60, { speed: 0, groundHeight });
  expect(model.group.position.toArray()).toEqual([4, 2, -6]);
  expect(model.group.rotation.x).toBeCloseTo(-Math.atan(0.3), 5);
  expect(model.group.rotation.z).toBeCloseTo(Math.atan(0.2), 5);
  expect(groundHeight.mock.calls.length).toBeLessThan(90);
  model.dispose();
});

it('braces a listening rabbit before flight and releases the pose smoothly', () => {
  const { model } = animal('rabbit');
  const motion = model.group.children[0]!;
  for (let frame = 0; frame < 90; frame++)
    model.update(1 / 60, { speed: 0, alert: true, tense: true });
  expect(motion.scale.y).toBeLessThan(0.98);
  expect(motion.rotation.x).toBeLessThan(-0.035);
  for (let frame = 0; frame < 180; frame++) model.update(1 / 60, { speed: 0 });
  expect(Math.abs(motion.rotation.x)).toBeLessThan(0.00001);
  model.dispose();
});
