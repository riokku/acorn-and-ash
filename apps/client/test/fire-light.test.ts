import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { FIRE_LIGHT_COUNT, FireLights, createFireGlow, isFireGlow } from '../src/scene/fire-light';

const VIEWER = new THREE.Vector3(0, 0, 0);

function pointLightsIn(scene: THREE.Scene): THREE.PointLight[] {
  const lights: THREE.PointLight[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.PointLight) lights.push(object);
  });
  return lights;
}

/** A steady fire, `x` metres from the viewer, in `parent`. */
function fireAt(
  parent: THREE.Object3D,
  x: number,
  intensity = 5,
): ReturnType<typeof createFireGlow> {
  const glow = createFireGlow(0xff8c42, intensity, 4, 0);
  glow.anchor.position.set(x, 0, 0);
  parent.add(glow.anchor);
  return glow;
}

/** Where the lit lights are, nearest first. */
function litAt(scene: THREE.Scene): number[] {
  return pointLightsIn(scene)
    .filter((light) => light.intensity > 0)
    .map((light) => light.position.x)
    .sort((a, b) => a - b);
}

describe('firelight', () => {
  it('keeps the very same lights in the scene however many fires come and go', () => {
    const scene = new THREE.Scene();
    const lights = new FireLights(scene);
    const before = pointLightsIn(scene);
    expect(before).toHaveLength(FIRE_LIGHT_COUNT);

    const fires = [1, 2, 3].map((x) => fireAt(scene, x));
    lights.update(VIEWER);
    for (const fire of fires) fire.anchor.visible = false;
    lights.update(VIEWER);
    for (const fire of fires) fire.dispose();
    lights.update(VIEWER);

    expect(pointLightsIn(scene)).toEqual(before);
  });

  it('lights each fire where it is, as bright as it is', () => {
    const scene = new THREE.Scene();
    const lights = new FireLights(scene);
    const holder = new THREE.Group();
    holder.position.set(10, 2, -3);
    scene.add(holder);
    const fire = fireAt(holder, 1, 7);
    lights.update(VIEWER);

    const lit = pointLightsIn(scene).filter((light) => light.intensity > 0);
    expect(lit).toHaveLength(1);
    expect(lit[0]?.position.toArray()).toEqual([11, 2, -3]);
    expect(lit[0]?.intensity).toBe(7);
    expect(lit[0]?.distance).toBe(4);

    fire.brightness = 0.5;
    lights.update(VIEWER);
    expect(lit[0]?.intensity).toBe(3.5);
  });

  it('gives the lights to the fires nearest the camera when there are too many', () => {
    const scene = new THREE.Scene();
    const lights = new FireLights(scene);
    const distances = Array.from({ length: FIRE_LIGHT_COUNT + 3 }, (_, index) => 30 - index * 2);
    for (const x of distances) fireAt(scene, x);
    lights.update(VIEWER);

    const nearest = [...distances].sort((a, b) => a - b).slice(0, FIRE_LIGHT_COUNT);
    expect(litAt(scene)).toEqual(nearest);
  });

  it('lights nothing from a fire that is hidden, put out or not in the scene', () => {
    const scene = new THREE.Scene();
    const lights = new FireLights(scene);
    const hiddenGroup = new THREE.Group();
    hiddenGroup.visible = false;
    scene.add(hiddenGroup);
    fireAt(hiddenGroup, 1);
    fireAt(new THREE.Group(), 2);
    fireAt(new THREE.Scene(), 3);
    fireAt(scene, 4).dispose();
    fireAt(scene, 5, 0);
    fireAt(scene, 6);
    lights.update(VIEWER);

    expect(litAt(scene)).toEqual([6]);
  });

  it('can tell a fire glow from anything else', () => {
    const fire = createFireGlow(0xffffff, 1, 1);
    expect(isFireGlow(fire.anchor)).toBe(true);
    expect(isFireGlow(new THREE.Object3D())).toBe(false);
    fire.dispose();
  });
});
