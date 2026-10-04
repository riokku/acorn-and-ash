import * as THREE from 'three/webgpu';
import { createRng, hashSeed, dayProgress, type ForestWeather } from '@acorn/shared';

/** Bounded, pooled rain and fireflies: no per-frame geometry or material allocation. */
export function createForestWeather(seed: number, heightAt: (x: number, z: number) => number) {
  const group = new THREE.Group();
  const rng = createRng(hashSeed('weather-art', seed));
  const count = 240;
  const offsets = Array.from({ length: count }, () => ({
    x: rng.nextRange(-17, 17),
    z: rng.nextRange(-17, 17),
    y: rng.nextRange(0, 14),
  }));
  const positions = new Float32Array(count * 6);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  const material = new THREE.LineBasicMaterial({
    color: 0xb8d5d6,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  const rain = new THREE.LineSegments(geometry, material);
  rain.frustumCulled = false;
  group.add(rain);
  const glowGeometry = new THREE.SphereGeometry(0.035, 5, 4);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xc8f19c,
    transparent: true,
    opacity: 0.8,
  });
  const fireflies = new THREE.InstancedMesh(glowGeometry, glowMaterial, 32);
  fireflies.frustumCulled = false;
  group.add(fireflies);
  const dummy = new THREE.Object3D();
  let strength = 0;
  let seconds = 0;
  return {
    group,
    visibleEffects: () => ({
      rainDrops: group.visible && rain.visible ? geometry.drawRange.count / 2 : 0,
      fireflies: group.visible && fireflies.visible ? fireflies.count : 0,
    }),
    update(
      delta: number,
      point: { x: number; z: number },
      nowMs: number,
      weather: ForestWeather,
      indoors: boolean,
      reducedMotion: boolean,
      /** How much of the rain shows, 1 for all of it: in winter the snow takes over instead. */
      rainShare = 1,
    ) {
      group.visible = !indoors;
      seconds += Math.min(delta, 0.1);
      strength += (weather.precipitation - strength) * Math.min(1, delta * 0.5);
      const visible = Math.round(count * strength * rainShare);
      rain.visible = visible > 0 && !reducedMotion;
      geometry.setDrawRange(0, visible * 2);
      for (let i = 0; i < visible; i++) {
        const o = offsets[i]!;
        const x = point.x + o.x + Math.sin(seconds * 0.15) * 0.3,
          z = point.z + o.z;
        const y = heightAt(x, z) + ((((o.y - seconds * (7 + weather.wind * 4)) % 14) + 14) % 14);
        const at = i * 6;
        positions[at] = x;
        positions[at + 1] = y;
        positions[at + 2] = z;
        positions[at + 3] = x - 0.08 - weather.wind * 0.12;
        positions[at + 4] = y + 0.45;
        positions[at + 5] = z - 0.05;
      }
      geometry.attributes.position!.needsUpdate = true;
      const day = dayProgress(nowMs);
      const dusk = day >= 0.67 && day <= 0.9;
      fireflies.visible = dusk && weather.kind !== 'storm';
      if (fireflies.visible) {
        for (let i = 0; i < 32; i++) {
          const o = offsets[i]!,
            t = reducedMotion ? 0 : seconds;
          const x = point.x + o.x + Math.sin(t * 0.4 + i) * 0.5,
            z = point.z + o.z + Math.cos(t * 0.3 + i) * 0.5;
          dummy.position.set(x, heightAt(x, z) + 0.7 + 0.3 * Math.sin(t * 0.6 + i));
          dummy.scale.setScalar(0.7 + 0.3 * Math.sin(t * 1.6 + i));
          dummy.updateMatrix();
          fireflies.setMatrixAt(i, dummy.matrix);
        }
        fireflies.instanceMatrix.needsUpdate = true;
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      glowGeometry.dispose();
      glowMaterial.dispose();
      fireflies.dispose();
      group.removeFromParent();
    },
  };
}
