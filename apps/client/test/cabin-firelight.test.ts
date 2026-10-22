import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { createCabin } from '../src/scene/cabin';
import { createLargeCabin } from '../src/scene/large-cabin';
import { FireLights } from '../src/scene/fire-light';
it.each([createCabin, createLargeCabin])(
  'keeps exterior windows dull until the fireplace is lit',
  (make) => {
    const cabin = make();
    const scene = new THREE.Scene();
    scene.add(cabin.group);
    const lights = new FireLights(scene);
    const glass = new Set<THREE.MeshStandardMaterial>();
    cabin.group.traverse((object) => {
      if (object instanceof THREE.Mesh)
        for (const material of Array.isArray(object.material) ? object.material : [object.material])
          if (
            material instanceof THREE.MeshStandardMaterial &&
            material.emissive.getHex() === 0xffb45c
          )
            glass.add(material);
    });
    const brightness = () => {
      lights.update(new THREE.Vector3());
      let sum = 0;
      scene.traverse((object) => {
        if (object instanceof THREE.PointLight) sum += object.intensity;
      });
      return sum;
    };
    try {
      expect(glass.size).toBe(1);
      for (const daylight of [0, 1]) {
        cabin.setDaylight?.(daylight);
        expect([...glass][0]!.emissiveIntensity).toBe(0);
        expect(brightness()).toBe(0);
        cabin.setLit?.(true);
        expect([...glass][0]!.emissiveIntensity).toBeGreaterThan(0);
        expect(brightness()).toBeGreaterThan(0);
        cabin.setLit?.(false);
        expect([...glass][0]!.emissiveIntensity).toBe(0);
        expect(brightness()).toBe(0);
      }
    } finally {
      cabin.dispose();
    }
  },
);
