import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { GatheringFocus } from '../src/scene/gathering-focus';
import { createGroundItems } from '../src/scene/ground-items';

describe('the next item to gather', () => {
  it('highlights exactly the next visible flower, then advances as the count shrinks', () => {
    const items = createGroundItems(() => 0);
    const patch = { id: 1, item: 'flower' as const, x: 5, z: 4, remaining: 3 };
    items.setGatherPatches([patch]);
    const focus = new GatheringFocus();
    const next = items.target('patch', 1)!;
    const mesh = next.children[0] as THREE.Mesh;
    const original = mesh.material;
    focus.setTarget(next, 0.28);
    focus.update(0.1);
    expect(mesh.material).not.toBe(original);
    expect(focus.group.position.x).toBeCloseTo(4.78);
    items.setGatherPatches([{ ...patch, remaining: 2 }]);
    const second = items.target('patch', 1)!;
    expect(second).not.toBe(next);
    focus.setTarget(second);
    expect(mesh.material).toBe(original);
    focus.setTarget(null);
    expect(focus.group.visible).toBe(false);
    focus.dispose();
    items.dispose();
  });

  it('uses the complete dropped pile and hides a picked-clean patch', () => {
    const items = createGroundItems(() => 2);
    items.setDroppedPiles([{ id: 2, item: 'log', count: 1, x: 4, z: 5 }]);
    expect(items.target('pile', 2)?.position.y).toBe(2);
    items.setGatherPatches([{ id: 1, item: 'stick', x: 0, z: 0, remaining: 0 }]);
    expect(items.target('patch', 1)).toBeNull();
    items.setDroppedPiles([]);
    expect(items.target('pile', 2)).toBeNull();
    items.dispose();
  });
});

it('fits the complete ring to sloping ground and keeps its footprint stable while pulsing', () => {
  const target = new THREE.Group();
  target.position.set(3, 4, 5);
  const surface = (x: number, z: number) => x * 0.4 + z * 0.2;
  const focus = new GatheringFocus(surface);
  focus.setTarget(target, 0.6);
  focus.update(0);
  const ring = focus.group.children[0] as THREE.Mesh;
  const positions = ring.geometry.getAttribute('position');
  const fitted = Array.from(positions.array);
  for (let i = 0; i < positions.count; i++) {
    const x = target.position.x + positions.getX(i),
      z = target.position.z + positions.getZ(i);
    expect(target.position.y + positions.getY(i)).toBeCloseTo(surface(x, z) + 0.025, 5);
  }
  focus.update(0.7);
  expect(Array.from(positions.array)).toEqual(fitted);
  target.position.x += 1;
  focus.update(0);
  expect(Array.from(positions.array)).not.toEqual(fitted);
  focus.dispose();
});
