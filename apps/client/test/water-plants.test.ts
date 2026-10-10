import type * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';

import { ModelBuilder } from '../src/art/shapes';
import { addLilyPad, waterPlantMaterials } from '../src/scene/water-plants';

it('keeps a turned lily pad and its underside on a sloping water surface', () => {
  const heightAt = (x: number, z: number): number => 3 + x * 0.12 - z * 0.08;
  const builder = new ModelBuilder();
  const materials = waterPlantMaterials();
  addLilyPad(builder, materials, { x: 5, y: heightAt(5, 7), z: 7 }, 0.4, 1.3, null, heightAt);
  const model = builder.build();
  for (const child of model.group.children) {
    const mesh = child as THREE.Mesh;
    const offset = mesh.material === materials.pad ? 0.012 : 0.006;
    const positions = mesh.geometry.getAttribute('position');
    for (let vertex = 0; vertex < positions.count; vertex++) {
      expect(positions.getY(vertex)).toBeCloseTo(
        heightAt(positions.getX(vertex), positions.getZ(vertex)) + offset,
        5,
      );
    }
  }
  model.dispose();
});
