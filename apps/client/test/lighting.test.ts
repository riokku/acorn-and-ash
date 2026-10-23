import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import { addDaylight } from '../src/scene/lighting';

function ambient(scene: THREE.Scene): THREE.HemisphereLight {
  return scene.children.find(
    (object): object is THREE.HemisphereLight => object instanceof THREE.HemisphereLight,
  )!;
}
function luminance(colour: THREE.Color) {
  return colour.r * 0.2126 + colour.g * 0.7152 + colour.b * 0.0722;
}

describe('outdoor light readability', () => {
  it('retains a dim readable fill in moonlight shadows without making night look like day', () => {
    const scene = new THREE.Scene();
    const rig = addDaylight(scene);
    const sky = ambient(scene);
    rig.update(0.5);
    const dayFill = luminance(sky.color) * sky.intensity;
    rig.update(0, 1, true);
    const nightFill = luminance(sky.color) * sky.intensity;
    expect(nightFill / dayFill).toBeGreaterThan(0.05);
    expect(nightFill / dayFill).toBeLessThan(0.15);
    expect(luminance(sky.groundColor) / luminance(sky.color)).toBeGreaterThan(0.2);
    expect(luminance(sky.groundColor)).toBeLessThan(luminance(sky.color));
    expect(rig.sun.intensity).toBeLessThan(sky.intensity);
  });
  it('keeps the same fog program through rooms and restores outdoor weather immediately', () => {
    const scene = new THREE.Scene();
    const rig = addDaylight(scene);
    const fog = scene.fog as THREE.Fog;
    rig.update(0.5);
    expect(fog.near).toBe(55);
    expect(fog.far).toBe(120);
    for (let visit = 0; visit < 3; visit++) {
      rig.setIndoors(true);
      rig.update(0.5, 1, true);
      expect(scene.fog).toBe(fog);
      expect(fog.near).toBeGreaterThan(1000);
      expect(fog.far).toBeGreaterThan(fog.near);
      for (let frame = 0; frame < 120; frame++) rig.update(0.5, 1, true);
      rig.setIndoors(false);
      expect(scene.fog).toBe(fog);
      expect(fog.near).toBeGreaterThanOrEqual(10);
      expect(fog.near).toBeLessThan(55);
      expect(fog.far).toBeGreaterThanOrEqual(48);
      expect(fog.far).toBeLessThan(120);
    }
  });
  it('keeps tunnel darkness, weather attenuation and the same lights through transitions', () => {
    const scene = new THREE.Scene();
    const rig = addDaylight(scene);
    const sky = ambient(scene);
    const lights = [...scene.children];
    rig.update(0);
    const outdoor = sky.intensity;
    const clearMoon = rig.sun.intensity;
    rig.update(0, 1);
    expect(rig.sun.intensity).toBeLessThan(clearMoon);
    expect(sky.intensity).toBe(outdoor);
    rig.setUnderground(1);
    rig.update(0, 1);
    expect(sky.intensity / outdoor).toBeCloseTo(0.06);
    rig.setUnderground(0);
    rig.update(0, 1);
    expect(sky.intensity).toBe(outdoor);
    const midnight = sky.color.clone();
    rig.update(0.01, 1);
    expect(Math.abs(sky.color.r - midnight.r)).toBeLessThan(0.002);
    expect(scene.children).toEqual(lights);
  });
});

it('opens the plains horizon gradually while retaining blizzard and tunnel visibility', () => {
  const scene = new THREE.Scene(),
    rig = addDaylight(scene);
  const fog = scene.fog as THREE.Fog;
  const normal = fog.far;
  for (let i = 0; i < 200; i++) rig.update(0.5, 0, false, 1);
  expect(fog.far).toBeGreaterThan(normal + 55);
  for (let i = 0; i < 200; i++) rig.update(0.5, 1, true, 1);
  expect(fog.far).toBeLessThan(50);
  rig.setUnderground(1);
  rig.update(0.5, 0, false, 1);
  expect(fog.far).toBe(22);
});
