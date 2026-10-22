import * as THREE from 'three/webgpu';
import { expect, it, vi } from 'vitest';
import { PROP_KINDS } from '@acorn/shared';
import * as models from '../src/scene/prop-models';
import { createPropMeshes } from '../src/scene/props';

it.each([
  [false, 'Needles'],
  [true, 'Needles'],
  [false, 'Leaves'],
  [true, 'Leaves'],
] as const)(
  'preserves painted low branches through grounding (distant=%s, material=%s)',
  (distant, name) => {
    const geometry = new THREE.ConeGeometry(3, 12, 8).translate(0, 6, 0);
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute(
      'color',
      new THREE.Float32BufferAttribute(Array(count).fill([0.1, 0.4, 0.15]).flat(), 3),
    );
    const material = new THREE.MeshStandardMaterial({ vertexColors: true });
    material.name = name;
    const mock = vi.spyOn(models, 'realModelPartsFor').mockReturnValue([{ geometry, material }]);
    try {
      const parts = createPropMeshes(PROP_KINDS.birch, 1, distant);
      const drawn = parts[0]!;
      expect(drawn.mesh.geometry.getAttribute('propGroundWeight').getX(0)).toBeDefined();
      expect((drawn.mesh.material as THREE.MeshStandardNodeMaterial).vertexColors).toBe(false);
      expect(drawn.mesh.geometry.getAttribute('color').getY(0)).toBeCloseTo(0.4);
      drawn.burn?.(0, 0.5);
      expect(drawn.mesh.geometry.getAttribute('treeBurn').getX(0)).toBe(0.5);
      parts.forEach((part) => part.dispose());
      expect(material.vertexColors).toBe(true);
    } finally {
      mock.mockRestore();
      geometry.dispose();
      material.dispose();
    }
  },
);
