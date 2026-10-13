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
