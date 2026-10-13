import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import type { ForestWeather } from '@acorn/shared';
import { createSeasonFall } from '../src/scene/season-fall';

const weather: ForestWeather = {
  kind: 'clear',
  cycle: 0,
  precipitation: 0,
  wind: 0.2,
  mushroomsAbundant: false,
};
const summer = { from: 'summer', to: 'summer', amount: 0 } as const;
function particles(mesh: THREE.InstancedMesh) {
  return Array.from({ length: mesh.count }, (_, i) => {
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(i, matrix);
    return {
      position: new THREE.Vector3().setFromMatrixPosition(matrix),
      scale: new THREE.Vector3().setFromMatrixScale(matrix).x,
    };
  });
}

describe('pollen in world space', () => {
  it('keeps the same grains in place when the camera turns or the player walks', () => {
    const effect = createSeasonFall(123, (x, z) => x * 0.3 + z * 0.1);
    const mesh = effect.group.getObjectByName('season-pollen') as THREE.InstancedMesh;
    effect.update(0, { x: 0, z: 0 }, summer, weather, 1, false, false);
    const before = particles(mesh);
    effect.update(0, { x: 8, z: -6 }, summer, weather, 1, false, false);
    const after = particles(mesh);
    let shared = 0;
    before.forEach((grain, i) => {
      if (Math.abs(grain.position.x) < 12 && Math.abs(grain.position.z) < 12) {
        expect(after[i]!.position.distanceTo(grain.position)).toBeLessThan(0.00001);
        expect(after[i]!.scale).toBeCloseTo(grain.scale, 5);
        shared++;
      }
    });
    expect(shared).toBeGreaterThan(50);
    effect.dispose();
  });

  it('fades recycled grains at the boundary instead of revealing a square edge', () => {
    const effect = createSeasonFall(123, () => 0);
    effect.update(0, { x: 0, z: 0 }, summer, weather, 1, false, false);
    const grains = particles(effect.group.getObjectByName('season-pollen') as THREE.InstancedMesh);
    const border = grains.filter(
      ({ position }) => Math.max(Math.abs(position.x), Math.abs(position.z)) > 31,
    );
    expect(border.length).toBeGreaterThan(10);
    expect(border.every(({ scale }) => scale < 0.03)).toBe(true);
    effect.dispose();
  });

  it('floats through slopes rather than rising and falling with the terrain below', () => {
    const flat = createSeasonFall(123, () => 0);
    const slope = createSeasonFall(123, (x) => x * 3);
    for (const effect of [flat, slope])
      effect.update(0, { x: 0, z: 0 }, summer, weather, 1, false, false);
    const mesh = (effect: typeof flat) =>
      effect.group.getObjectByName('season-pollen') as THREE.InstancedMesh;
    const initial = particles(mesh(slope)).map(
      (grain, i) => grain.position.y - particles(mesh(flat))[i]!.position.y,
    );
    for (let frame = 0; frame < 60; frame++) {
      for (const effect of [flat, slope])
        effect.update(1 / 60, { x: 0, z: 0 }, summer, weather, 1, false, false);
    }
    const a = particles(mesh(flat));
    const b = particles(mesh(slope));
    b.forEach((grain, i) => {
      if (Math.abs(grain.position.x) < 30 && Math.abs(grain.position.z) < 30)
        expect(grain.position.y - a[i]!.position.y).toBeCloseTo(initial[i]!, 4);
    });
    flat.dispose();
    slope.dispose();
  });

  it('does not teleport grains when the wind forecast changes', () => {
    const effect = createSeasonFall(123, () => 0);
    effect.update(0.1, { x: 0, z: 0 }, summer, weather, 1, false, false);
    const mesh = effect.group.getObjectByName('season-pollen') as THREE.InstancedMesh;
    const before = particles(mesh);
    effect.update(0, { x: 0, z: 0 }, summer, { ...weather, wind: 0.8 }, 1, false, false);
    particles(mesh).forEach((grain, i) =>
      expect(grain.position.distanceTo(before[i]!.position)).toBe(0),
    );
    effect.dispose();
  });

  it('still hides pollen indoors, at night, in blizzards and with reduced motion', () => {
    const effect = createSeasonFall(123, () => 0);
    for (const [daylight, indoors, reduced, forecast] of [
      [0, false, false, weather],
      [1, true, false, weather],
      [1, false, true, weather],
      [1, false, false, { ...weather, kind: 'blizzard' as const }],
    ] as const) {
      effect.update(0, { x: 0, z: 0 }, summer, forecast, daylight, indoors, reduced);
      expect(effect.visibleEffects().pollen).toBe(0);
    }
    effect.dispose();
  });
});
