import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { DAY_LENGTH_MS, type ForestWeather } from '@acorn/shared';
import { createForestWeather } from '../src/scene/forest-weather';
const dusk = DAY_LENGTH_MS * 0.75;
const clear: ForestWeather = {
  kind: 'clear',
  cycle: 0,
  precipitation: 0,
  wind: 0.2,
  mushroomsAbundant: false,
};
function samples(effect: ReturnType<typeof createForestWeather>) {
  const mesh = effect.group.getObjectByName('weather-fireflies') as THREE.InstancedMesh;
  return Array.from({ length: mesh.count }, (_, i) => {
    const matrix = new THREE.Matrix4();
    mesh.getMatrixAt(i, matrix);
    return {
      position: new THREE.Vector3().setFromMatrixPosition(matrix),
      scale: new THREE.Vector3().setFromMatrixScale(matrix).x,
    };
  });
}
function update(
  effect: ReturnType<typeof createForestWeather>,
  delta = 0,
  point = { x: 0, z: 0 },
  weather = clear,
  reduced = false,
  indoors = false,
  clock = dusk,
) {
  effect.update(delta, point, clock, weather, indoors, reduced);
}
describe('dusk fireflies in the world', () => {
  it('keeps visible fireflies anchored when the player walks or the camera turns', () => {
    const effect = createForestWeather(123, (x, z) => x * 0.2 + z * 0.1);
    update(effect);
    const before = samples(effect);
    update(effect, 0, { x: 8, z: -6 });
    const after = samples(effect);
    let checked = 0;
    before.forEach((grain, i) => {
      if (Math.abs(grain.position.x) < 12 && Math.abs(grain.position.z) < 12) {
        expect(after[i]!.position.distanceTo(grain.position)).toBeLessThan(1e-5);
        expect(after[i]!.scale).toBeCloseTo(grain.scale, 5);
        checked++;
      }
    });
    expect(checked).toBeGreaterThan(10);
    effect.dispose();
  });
  it('fades recycling at the far border, including after crossing several world tiles', () => {
    const effect = createForestWeather(123, () => 0);
    for (const point of [
      { x: 0, z: 0 },
      { x: 200, z: -140 },
    ]) {
      update(effect, 0, point);
      const border = samples(effect).filter(
        (g) => Math.max(Math.abs(g.position.x - point.x), Math.abs(g.position.z - point.z)) > 31,
      );
      expect(border.length).toBeGreaterThan(0);
      expect(border.every((g) => g.scale < 0.03)).toBe(true);
    }
    effect.dispose();
  });
  it('preserves airborne height through gentle flight over slopes', () => {
    const flat = createForestWeather(123, () => 0),
      slope = createForestWeather(123, (x) => x * 3);
    for (const effect of [flat, slope]) update(effect);
    const initial = samples(slope).map((g, i) => g.position.y - samples(flat)[i]!.position.y);
    for (let i = 0; i < 60; i++) for (const effect of [flat, slope]) update(effect, 1 / 60);
    const a = samples(flat),
      b = samples(slope);
    b.forEach((g, i) => {
      if (Math.abs(g.position.x) < 30 && Math.abs(g.position.z) < 30)
        expect(g.position.y - a[i]!.position.y).toBeCloseTo(initial[i]!, 4);
    });
    flat.dispose();
    slope.dispose();
  });
  it('retains weather, indoor and reduced-motion visibility behavior', () => {
    const effect = createForestWeather(123, () => 0);
    update(effect);
    expect(effect.visibleEffects().fireflies).toBe(112);
    update(effect, 0, { x: 0, z: 0 }, { ...clear, kind: 'storm' });
    expect(effect.visibleEffects().fireflies).toBe(0);
    update(effect, 0, { x: 0, z: 0 }, { ...clear, kind: 'blizzard' });
    expect(effect.visibleEffects().fireflies).toBe(0);
    update(effect, 0, { x: 0, z: 0 }, clear, false, true);
    expect(effect.visibleEffects().fireflies).toBe(0);
    update(effect, 0, { x: 0, z: 0 }, clear, false, false, DAY_LENGTH_MS * 0.5);
    expect(effect.visibleEffects().fireflies).toBe(0);
    update(effect, 0, { x: 0, z: 0 }, clear, true);
    const before = samples(effect);
    update(effect, 1, { x: 0, z: 0 }, clear, true);
    samples(effect).forEach((g, i) => expect(g.position.distanceTo(before[i]!.position)).toBe(0));
    effect.dispose();
  });
});
