import * as THREE from 'three/webgpu';
import { PROP_KINDS, type PlacedProp } from '@acorn/shared';
import { expect, it } from 'vitest';
import {
  buryGeometryBase,
  groundWeights,
  propBurialDepth,
  propFootprint,
} from '../src/scene/prop-grounding';
import { createPropMeshes, placeInstance, placeOneInstance } from '../src/scene/props';

it('buries the entire flat base on slopes at different scales without moving the top', () => {
  const geometry = new THREE.CylinderGeometry(0.8, 1.2, 4, 12);
  const footprint = propFootprint([{ geometry, offsetY: 2 }], 0.6);
  const weights = groundWeights(geometry, 2, footprint);
  const positions = geometry.getAttribute('position');
  for (const slope of [0, 0.3, 0.8, 1.5])
    for (const scale of [0.6, 1, 2]) {
      const terrain = {
        kind: 'slope',
        heightAt: (x: number, z: number) => x * slope + z * slope * 0.4,
      };
      const prop = { x: 3, z: -2, y: terrain.heightAt(3, -2), scale };
      const depth = propBurialDepth(prop, footprint, terrain);
      for (let vertex = 0; vertex < positions.count; vertex++) {
        if (positions.getY(vertex) === -2) {
          const x = prop.x + positions.getX(vertex) * scale;
          const z = prop.z + positions.getZ(vertex) * scale;
          expect(prop.y - weights[vertex]! * depth).toBeLessThan(terrain.heightAt(x, z));
        } else expect(weights[vertex]).toBe(0);
      }
    }
  geometry.dispose();
});

it('keeps the same tree anchor and burial through distance changes and regrowth', () => {
  const terrain = { kind: 'slope', heightAt: (x: number) => x * 0.7 };
  const prop: PlacedProp = { id: 1, kind: 'pine', x: 0, y: 0, z: 0, scale: 1, rotationY: 0.4 };
  const near = createPropMeshes(PROP_KINDS.pine, 1, false, terrain);
  const far = createPropMeshes(PROP_KINDS.pine, 1, true, terrain);
  for (const scale of [1, 2, 0.7]) {
    const grown = { ...prop, scale };
    placeInstance(near, 0, grown);
    placeInstance(far, 0, grown);
    const depth = near[0]!.mesh.geometry.getAttribute('propGroundDepth').getX(0);
    expect(depth).toBeGreaterThan(0);
    expect(far[0]!.mesh.geometry.getAttribute('propGroundDepth').getX(0)).toBe(depth);
    const matrix = new THREE.Matrix4();
    near[0]!.mesh.getMatrixAt(0, matrix);
    expect(matrix.elements[13]).toBeCloseTo(
      PROP_KINDS.pine.shape.family === 'tree' ? (PROP_KINDS.pine.shape.trunkHeight * scale) / 2 : 0,
    );
  }
  for (const part of [...near, ...far]) part.dispose();
});

it('keeps shaken roots buried but releases an uprooted tree during its fall', () => {
  const parts = createPropMeshes(PROP_KINDS.pine, 1, false, {
    kind: 'slope',
    heightAt: (x) => x * 0.5,
  });
  const prop: PlacedProp = { id: 1, kind: 'pine', x: 0, y: 0, z: 0, scale: 1, rotationY: 0 };
  placeInstance(parts, 0, prop);
  const depth = parts[0]!.mesh.geometry.getAttribute('propGroundDepth');
  const standing = depth.getX(0);
  placeOneInstance(
    parts[0]!,
    0,
    prop,
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0.02),
  );
  expect(depth.getX(0)).toBe(standing);
  placeOneInstance(
    parts[0]!,
    0,
    prop,
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2),
  );
  expect(depth.getX(0)).toBe(0);
  for (const part of parts) part.dispose();
});

it('extends a merged shore rock base below a slope while preserving its upper vertices', () => {
  const rock = new THREE.CylinderGeometry(0.5, 1, 1, 8).translate(0, 0.5, 0);
  const positions = rock.getAttribute('position');
  const top = Array.from({ length: positions.count }, (_, i) => positions.getY(i));
  const heightAt = (x: number, z: number) => 0.8 * x + 0.2 * z;
  buryGeometryBase(rock, { x: 0, y: 0, z: 0 }, heightAt);
  for (let i = 0; i < positions.count; i++) {
    if (top[i] === 1) expect(positions.getY(i)).toBe(1);
    else expect(positions.getY(i)).toBeLessThan(heightAt(positions.getX(i), positions.getZ(i)));
  }
  rock.dispose();
});
