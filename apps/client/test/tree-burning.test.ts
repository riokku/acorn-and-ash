import * as THREE from 'three/webgpu';
import { afterEach, expect, it, vi } from 'vitest';
import { PROP_KINDS, type WildfireView } from '@acorn/shared';
import { createPropMeshes, placeInstance } from '../src/scene/props';
import { createTreeBurning } from '../src/scene/tree-burning';

const resources: Array<{ dispose(): void }> = [];
afterEach(() => {
  resources.splice(0).forEach((part) => part.dispose());
  vi.restoreAllMocks();
});
const tree = { id: 5, kind: 'pine' as const, x: 0, z: 0, rotationY: 0, scale: 1 };
const state = (now: number): WildfireView => ({
  now,
  lightning: null,
  fires: [
    {
      id: 5,
      kind: 'tree',
      x: 0,
      y: 0,
      z: 0,
      height: 14,
      radius: 1,
      startedAt: 1000,
      generation: 0,
      spread: true,
    },
  ],
});

it('chars bark and canopy independently and keeps the root burial live', () => {
  const parts = createPropMeshes(PROP_KINDS.pine, 2, false, {
    kind: 'slope',
    heightAt: (x) => x * 0.5,
  });
  resources.push(...parts);
  placeInstance(parts, 0, tree);
  placeInstance(parts, 1, { ...tree, id: 6, x: 4 });
  for (const part of parts) {
    expect(part.mesh.material).toBeInstanceOf(THREE.MeshStandardNodeMaterial);
    expect(part.mesh.geometry.getAttribute('treeBurn').getX(0)).toBe(0);
    part.burn?.(0, 0.5);
    expect(part.mesh.geometry.getAttribute('treeBurn').getX(0)).toBe(0.5);
    expect(part.mesh.geometry.getAttribute('treeBurn').getX(1)).toBe(0);
  }
  const depth = parts[0]!.mesh.geometry.getAttribute('propGroundDepth');
  expect(depth.getX(0)).toBeGreaterThan(0);
  const prior = depth.getX(0);
  placeInstance(parts, 0, { ...tree, scale: 2 });
  expect(depth.getX(0)).toBeGreaterThan(prior);
});

it('resumes mid-burn, follows a repacked LOD slot, and stays charred until regrowth', () => {
  let now = 100;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const near = createPropMeshes(PROP_KINDS.pine, 2);
  const far = createPropMeshes(PROP_KINDS.pine, 2, true);
  resources.push(...near, ...far);
  let slot = { parts: near, index: 0 };
  const burn = createTreeBurning(() => slot);
  burn.setState(state(23_500));
  burn.update();
  expect(near[0]!.mesh.geometry.getAttribute('treeBurn').getX(0)).toBe(0.5);
  now += 4500;
  slot = { parts: far, index: 1 };
  placeInstance(far, 1, tree);
  burn.update();
  expect(far[0]!.mesh.geometry.getAttribute('treeBurn').getX(1)).toBeCloseTo(0.6);
  burn.setBurned(5, true);
  burn.setState({ fires: [], lightning: null, now: 46_000 });
  burn.update();
  expect(far[0]!.mesh.geometry.getAttribute('treeBurn').getX(1)).toBe(1);
  burn.setBurned(5, false);
  burn.update();
  expect(far[0]!.mesh.geometry.getAttribute('treeBurn').getX(1)).toBe(0);
});

it('clears a canceled fire without restarting the clock when the same state is reapplied', () => {
  let now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  const parts = createPropMeshes(PROP_KINDS.pine, 1);
  resources.push(...parts);
  const burn = createTreeBurning(() => ({ parts, index: 0 }));
  const received = state(1000);
  burn.setState(received);
  now = 22_500;
  burn.setState(received);
  burn.update();
  expect(parts[0]!.mesh.geometry.getAttribute('treeBurn').getX(0)).toBe(0.5);
  burn.setState({ fires: [], lightning: null, now: 23_500 });
  burn.update();
  expect(parts[0]!.mesh.geometry.getAttribute('treeBurn').getX(0)).toBe(0);
});
