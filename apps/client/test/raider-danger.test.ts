import { expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import {
  ActionKind,
  CHARGE_TICKS,
  CHOP_FACING_COSINE,
  CHOP_REACH,
  HOLLOW_KING,
  LIGHT_COMBO,
  STRIKE,
  windupTicks,
  type RaiderKindId,
} from '@acorn/shared';
import { RaiderDanger } from '../src/scene/raider-danger';

const at = { x: 10, y: 2, z: 20, yaw: 0 };
const move = (kind: ActionKind, age = 0, step = 0) => ({ kind, age, step });
type Warning = THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;

it.each<RaiderKindId>(['minion', 'rogue', 'warrior', 'mage', 'sentinel', 'captain', 'hollowKing'])(
  '%s warns ahead using its combat reach and facing cone, then yields to recovery',
  (kind) => {
    const parent = new THREE.Group();
    const danger = new RaiderDanger(parent, kind);
    const [circle, cone] = danger.group.children as Warning[];
    try {
      danger.update(at, move(ActionKind.Windup, 0));
      const initial = cone!.material.opacity;
      danger.update(at, move(ActionKind.Windup, windupTicks(0)));
      expect(danger.group.visible).toBe(true);
      expect(cone!.visible).toBe(true);
      expect(circle!.visible).toBe(false);
      expect(cone!.material.opacity).toBeGreaterThan(initial);
      const p = cone!.geometry.parameters;
      expect(p.outerRadius).toBe(kind === 'hollowKing' ? HOLLOW_KING.reach : CHOP_REACH);
      expect(Math.cos(p.thetaLength / 2)).toBeCloseTo(
        kind === 'hollowKing' ? 0.25 : CHOP_FACING_COSINE,
      );
      const positions = cone!.geometry.getAttribute('position');
      // Every vertex is on the advertised forward side, yaw zero facing -Z.
      for (let i = 0; i < positions.count; i++) expect(positions.getZ(i)).toBeLessThan(0);
      for (let step = 1; step <= 3; step++) {
        const impact = LIGHT_COMBO[step - 1]!.impact;
        danger.update(at, move(ActionKind.Swing, impact, step));
        const contact = cone!.material.opacity;
        danger.update(at, move(ActionKind.Swing, impact + 1, step));
        expect(cone!.material.opacity).toBeLessThan(contact);
        danger.update(at, move(ActionKind.Swing, impact + 2, step));
        expect(danger.group.visible).toBe(false);
      }
    } finally {
      danger.dispose();
    }
    expect(parent.children).toHaveLength(0);
  },
);

it.each<RaiderKindId>(['warrior', 'hollowKing'])(
  '%s builds a full-circle warning through its own charge and clears it at the end of the spin',
  (kind) => {
    const danger = new RaiderDanger(new THREE.Group(), kind);
    const [circle, cone] = danger.group.children as Warning[];
    try {
      const full = kind === 'hollowKing' ? HOLLOW_KING.chargeTicks : CHARGE_TICKS;
      danger.update(at, move(ActionKind.Charge, full / 2));
      const halfway = circle!.material.opacity;
      danger.update(at, move(ActionKind.Charge, full));
      expect(circle!.material.opacity).toBeGreaterThan(halfway);
      expect(circle!.visible).toBe(true);
      expect(cone!.visible).toBe(false);
      expect(circle!.geometry.parameters.thetaLength).toBe(Math.PI * 2);
      danger.update(at, move(ActionKind.Strike, STRIKE.spinEnd - 0.1));
      expect(danger.group.visible).toBe(true);
      danger.update(at, move(ActionKind.Strike, STRIKE.spinEnd));
      expect(danger.group.visible).toBe(false);
      for (const kind of [
        ActionKind.Idle,
        ActionKind.Flinch,
        ActionKind.Dodge,
        ActionKind.KnockedOut,
      ]) {
        danger.update(at, move(ActionKind.Windup));
        danger.update(at, move(kind));
        expect(danger.group.visible).toBe(false);
      }
    } finally {
      danger.dispose();
    }
  },
);

it('fits the warning to rotated uneven ground, caches stationary fits, and releases its resources', () => {
  const parent = new THREE.Group();
  const danger = new RaiderDanger(parent, 'warrior');
  const height = vi.fn((x: number, z: number) => x * 0.2 + Math.sin(z) * 0.1);
  const pose = { ...at, yaw: 1.1, y: height(at.x, at.z) };
  const winding = move(ActionKind.Windup, 5);
  danger.update(pose, winding, height);
  parent.updateMatrixWorld(true);
  const point = new THREE.Vector3();
  const [circle, cone] = danger.group.children as Warning[];
  for (const mesh of [circle!, cone!]) {
    const positions = mesh.geometry.getAttribute('position');
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld);
      expect(point.y).toBeCloseTo(height(point.x, point.z) + 0.045, 5);
    }
  }
  height.mockClear();
  danger.update(pose, winding, height);
  expect(height).not.toHaveBeenCalled();
  danger.update({ ...pose, x: pose.x + 0.1 }, winding, height);
  expect(height).toHaveBeenCalled();
  danger.hide();
  expect(danger.group.visible).toBe(false);
  danger.update(pose, winding, () => NaN);
  for (const mesh of [circle!, cone!])
    expect(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(
      true,
    );
  const material = vi.spyOn(circle!.material, 'dispose');
  const circleGeometry = vi.spyOn(circle!.geometry, 'dispose');
  const coneGeometry = vi.spyOn(cone!.geometry, 'dispose');
  danger.dispose();
  expect(material).toHaveBeenCalledOnce();
  expect(circleGeometry).toHaveBeenCalledOnce();
  expect(coneGeometry).toHaveBeenCalledOnce();
  expect(parent.children).toHaveLength(0);
});
