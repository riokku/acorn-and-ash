import { expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { ActionKind, HOLLOW_KING, STRIKE } from '@acorn/shared';
import { KingDanger } from '../src/scene/king-danger';

it('shows the shared reach on the correct side, then clears after the damaging spin', () => {
  const parent = new THREE.Group(),
    danger = new KingDanger(parent);
  const at = { x: 10, y: 2, z: 20, yaw: 0 };
  danger.update(at, ActionKind.Windup, 5);
  expect(danger.group.visible).toBe(true);
  const [circle, cone] = danger.group.children as THREE.Mesh<THREE.RingGeometry>[];
  expect(cone!.visible).toBe(true);
  expect(circle!.visible).toBe(false);
  const p = cone!.geometry.parameters;
  expect(p.outerRadius).toBe(HOLLOW_KING.reach);
  const middle = p.thetaStart + p.thetaLength / 2;
  expect(
    new THREE.Vector3(Math.cos(middle), Math.sin(middle), 0).applyEuler(cone!.rotation).z,
  ).toBeCloseTo(-1);
  danger.update(at, ActionKind.Charge, 30);
  expect(circle!.visible).toBe(true);
  expect(cone!.visible).toBe(false);
  danger.update(at, ActionKind.Strike, STRIKE.spinEnd);
  expect(danger.group.visible).toBe(false);
  danger.update(at, ActionKind.KnockedOut, 0);
  expect(danger.group.visible).toBe(false);
  danger.dispose();
  expect(parent.children).toHaveLength(0);
});
