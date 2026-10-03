import * as THREE from 'three/webgpu';
import type { EncounterSite, Terrain } from '@acorn/shared';
import { ModelBuilder, placed, plankGeometry, stoneGeometry } from '../art/shapes';
import { paintedMaterial } from '../art/materials';

/** Forest landmarks: broken masonry, old trail cairns and frayed patrol pennants. */
export function createEncounterLandmarks(sites: readonly EncounterSite[], terrain: Terrain) {
  const builder = new ModelBuilder();
  const stone = paintedMaterial('stone', { tint: 0xe2d9c7, roughness: 1 });
  const moss = paintedMaterial('stone', { tint: 0xadc394, roughness: 1 });
  const wood = paintedMaterial('wood', { tint: 0x9a8060, roughness: 1 });
  const cloth = paintedMaterial('burlap', { tint: 0xa4d9cf, roughness: 1 });
  for (const site of sites) {
    const y = terrain.heightAt(site.x, site.z);
    if (site.kind === 'ruins') {
      for (const dx of [-2.1, 2.1])
        for (const dz of [-2.1, 2.1]) {
          for (let row = 0; row < 3; row++) {
            builder.add(
              row === 0 ? moss : stone,
              plankGeometry(0.53, 0.34, 0.48, 'x', 0.8, site.id * 100 + row),
              placed(site.x + dx, y + 0.18 + row * 0.36, site.z + dz, {
                y: row % 2 === 0 ? 0 : 0.04,
              }),
            );
          }
        }
      for (const dx of [-1.5, -0.9, 0.9, 1.5]) {
        builder.add(
          moss,
          plankGeometry(0.55, 0.26, 0.48, 'x', 0.8, site.id * 100 + dx),
          placed(site.x + dx, y + 0.14, site.z + 2.1),
        );
      }
      // Weathered caps and a broken arch distinguish dressed masonry from loose rocks.
      for (const dx of [-2.1, 2.1])
        for (const dz of [-2.1, 2.1])
          builder.add(
            stone,
            plankGeometry(0.62, 0.12, 0.58, 'x', 0.8, site.id + dx + dz),
            placed(site.x + dx, y + 1.14, site.z + dz),
          );
      for (const dx of [-1.77, 1.77])
        builder.add(
          stone,
          plankGeometry(0.6, 0.23, 0.42, 'x', 0.8, site.id + dx),
          placed(site.x + dx, y + 1.29, site.z - 2.1, { z: dx < 0 ? 0.1 : -0.1 }),
        );
      for (const dx of [-0.7, 0.1, 0.9])
        for (const dz of [-0.9, -0.1, 0.7])
          builder.add(
            dx + dz > 0 ? moss : stone,
            plankGeometry(0.72, 0.045, 0.71, 'x', 0.8, site.id + dx * 9 + dz),
            placed(site.x + dx, terrain.heightAt(site.x + dx, site.z + dz) + 0.02, site.z + dz),
          );
      // Fallen arch blocks and old foundations frame the fight without closing its exits.
      for (let i = 0; i < 4; i++)
        builder.add(
          stone,
          plankGeometry(0.52, 0.22, 0.4, 'x', 0.8, site.id * 10 + i),
          placed(site.x - 2.8 + i * 0.8, y + 0.11, site.z - 2.7, { y: i * 0.7 }),
        );
    } else {
      const dx = site.kind === 'patrol' ? 2.8 : -2.8;
      for (let i = 0; i < 3; i++)
        builder.add(
          i === 0 ? moss : stone,
          stoneGeometry(0.34 - i * 0.075, 0.21, site.id * 10 + i),
          placed(site.x + dx, y + 0.105 + i * 0.19, site.z + 2.7),
        );
      if (site.kind === 'patrol') {
        builder.add(
          wood,
          plankGeometry(0.055, 1.3, 0.055, 'y', 1, site.id),
          placed(site.x + dx, y + 0.85, site.z + 2.7, { z: -0.13 }),
        );
        const flag = new THREE.BufferGeometry();
        flag.setAttribute(
          'position',
          new THREE.Float32BufferAttribute(
            [
              0, 0, 0, 0.5, -0.08, 0, 0.38, -0.24, 0, 0, 0, 0, 0.38, -0.24, 0, 0, -0.38, 0, 0, 0,
              0.012, 0.38, -0.24, 0.012, 0.5, -0.08, 0.012, 0, 0, 0.012, 0, -0.38, 0.012, 0.38,
              -0.24, 0.012,
            ],
            3,
          ),
        );
        flag.computeVertexNormals();
        builder.add(cloth, flag, placed(site.x + dx + 0.15, y + 1.4, site.z + 2.7));
      }
    }
  }
  const model = builder.build();
  model.group.name = 'forest-encounter-landmarks';
  return model;
}
