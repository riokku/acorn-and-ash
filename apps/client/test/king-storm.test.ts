import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import {
  KING_WARDS,
  CROWNBREAKER_HOLD,
  SOUL_STORM,
  createFlatTerrain,
  type KingStormView,
} from '@acorn/shared';
import { KingStormEffect } from '../src/scene/king-storm';
import { rehearseEffects } from '../src/scene/effect-rehearsal';
const warning: KingStormView = {
  bossId: 20001,
  wave: 1,
  phase: 'warning',
  remainingTicks: 140,
  sheltered: false,
  outside: false,
};
it('aligns shelter circles with shared ward positions, rehearse safely, and clears on recovery or disposal', () => {
  const effect = new KingStormEffect(createFlatTerrain(2)),
    scene = new THREE.Group();
  scene.add(effect.group);
  expect(effect.group.visible).toBe(false);
  rehearseEffects([effect.group], () =>
    expect(effect.group.children.every((child) => child.visible)).toBe(true),
  );
  expect(effect.group.visible).toBe(false);
  effect.update(warning, 1);
  const circles = effect.group.children.filter(
    (child) =>
      child instanceof THREE.Mesh &&
      child.geometry instanceof THREE.RingGeometry &&
      child.geometry.parameters.outerRadius === SOUL_STORM.shelterRadius,
  );
  expect(circles).toHaveLength(3);
  expect(
    circles.map((child) => [
      child.position.x + CROWNBREAKER_HOLD.x,
      child.position.z + CROWNBREAKER_HOLD.z,
    ]),
  ).toEqual(KING_WARDS.map((ward) => [ward.x, ward.z]));
  effect.update({ ...warning, phase: 'recovery', remainingTicks: 76 }, 13);
  expect(circles.every((child) => !child.visible)).toBe(true);
  effect.update(null, 16);
  expect(effect.group.visible).toBe(false);
  effect.dispose();
  expect(scene.children).toHaveLength(0);
  expect(effect.group.children).toHaveLength(0);
});
it('keeps ward shelter visible in reduced motion while removing the moving shroud', () => {
  const effect = new KingStormEffect(createFlatTerrain());
  try {
    effect.update({ ...warning, phase: 'storm', remainingTicks: 100 }, 8, true);
    const shroud = effect.group.children.filter(
      (child) => child instanceof THREE.Mesh && child.geometry instanceof THREE.PlaneGeometry,
    );
    expect(shroud).toHaveLength(4);
    expect(shroud.every((child) => !child.visible)).toBe(true);
    const shields = effect.group.children.filter(
      (child) => child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry,
    );
    expect(shields).toHaveLength(3);
    expect(shields.every((child) => child.visible)).toBe(true);
  } finally {
    effect.dispose();
  }
});
