import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { TREE_DUST_CAPACITY, TreeLandingEffects } from '../src/scene/tree-landing';

describe('landing dust', () => {
  it('billows and fades completely, keeping simultaneous falls within a fixed pool', () => {
    const effects = new TreeLandingEffects();
    const camera = new THREE.PerspectiveCamera();
    const mesh = effects.group.children[0] as THREE.InstancedMesh;
    const alpha = mesh.geometry.getAttribute('puffOpacity');
    for (let i = 0; i < 20; i++)
      effects.burst({ id: i, kind: 'oak', x: i, z: 0, scale: 1, rotationY: 0 }, 0);
    effects.update(0.1, camera);
    expect(mesh.count).toBe(TREE_DUST_CAPACITY);
    expect(effects.group.children).toHaveLength(1);
    expect(Array.from(alpha.array).some((value) => value > 0)).toBe(true);
    effects.update(3, camera);
    expect(Array.from(alpha.array).every((value) => value === 0)).toBe(true);
    effects.dispose();
  });
});
