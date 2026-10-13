import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';
import {
  colliderTopAt,
  surfaceCollider,
  stonePositions,
  embeddedStonePositions,
  buildSpringRocks,
  STREAM,
  createWildernessTerrain,
} from '@acorn/shared';
import { stoneGeometry } from '../src/art/shapes';
import { buryGeometryBase } from '../src/scene/prop-grounding';

it('uses the same buried spring triangles in the renderer and shared collision', () => {
  const terrain = createWildernessTerrain(2026);
  for (const rock of buildSpringRocks(STREAM, terrain)) {
    const geometry = buryGeometryBase(
      stoneGeometry(rock.radius, rock.height, rock.seed, rock.tile, rock.detail),
      rock,
      terrain.heightAt,
    );
    const drawn = geometry.getAttribute('position'),
      solid = embeddedStonePositions(rock, terrain);
    for (let i = 0; i < drawn.count; i++) {
      expect(drawn.getX(i)).toBe(solid[i * 3]);
      expect(drawn.getY(i)).toBeCloseTo(solid[i * 3 + 1]!, 5);
      expect(drawn.getZ(i)).toBe(solid[i * 3 + 2]);
    }
    geometry.dispose();
  }
});

describe('the visible rock roof', () => {
  for (const detail of [0, 1])
    it(`matches actual mesh raycasts at detail ${detail}, rotation and scale`, () => {
      const positions = stonePositions(1.4, 1, 5909, detail);
      const collider = surfaceCollider(4, 3, 6, positions, 0.73, 1.2);
      const geometry = stoneGeometry(1.4, 1, 5909, 0.8, detail);
      const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(4, 3, 6);
      mesh.rotation.y = 0.73;
      mesh.scale.setScalar(1.2);
      mesh.updateMatrixWorld(true);
      const ray = new THREE.Raycaster();
      let checked = 0;
      for (let x = 2; x <= 6; x += 0.25)
        for (let z = 4; z <= 8; z += 0.25) {
          ray.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
          const hit = ray.intersectObject(mesh)[0],
            roof = colliderTopAt(collider, x, z);
          if (hit) {
            expect(roof).toBeCloseTo(hit.point.y, 5);
            checked++;
          } else expect(roof).toBeNull();
        }
      expect(checked).toBeGreaterThan(50);
      geometry.dispose();
      material.dispose();
    });
});
