import * as THREE from 'three/webgpu';
import type { DiscoverySite, Terrain } from '@acorn/shared';
import { ModelBuilder, placed, plankGeometry, logGeometry, stoneGeometry } from '../art/shapes';
import { paintedMaterial } from '../art/materials';

/** Handcrafted remnants of forest life, arranged around open, walkable centers. */
export function createDiscoveryLandmarks(sites: readonly DiscoverySite[], terrain: Terrain) {
  const builder = new ModelBuilder();
  const wood = paintedMaterial('wood', { tint: 0xd3b492, roughness: 1 });
  const bark = paintedMaterial('bark', { tint: 0xd0b09a, roughness: 1 });
  const cut = paintedMaterial('logEnd', { tint: 0xf0dbb6, roughness: 1 });
  const linen = paintedMaterial('burlap', { tint: 0xedd7aa, roughness: 1 });
  const blanket = paintedMaterial('burlap', { tint: 0x88aaa0, roughness: 1 });
  const trim = paintedMaterial('wood', { tint: 0x79664b, roughness: 1 });
  const moss = paintedMaterial('stone', { tint: 0xadc394, roughness: 1 });
  for (const site of sites) {
    if (site.kind === 'elkGrove' || site.kind === 'guardianHollow') continue;
    if (site.kind === 'raccoonHollow') {
      const y = terrain.heightAt(site.x + 0.75, site.z);
      const fallen = logGeometry(1.5, 0.22, { seed: 1009, sides: 8 });
      const matrix = placed(site.x + 0.75, y + 0.24, site.z, { y: 0.7 });
      builder.add(bark, fallen.side, matrix).add(cut, fallen.ends, matrix);
      builder.add(
        wood,
        new THREE.BoxGeometry(0.35, 0.19, 0.3),
        placed(site.x + 0.3, y + 0.1, site.z + 0.45),
      );
      for (const dx of [-0.11, 0.11])
        builder.add(
          trim,
          new THREE.BoxGeometry(0.025, 0.2, 0.31),
          placed(site.x + 0.3 + dx, y + 0.11, site.z + 0.45),
        );
      builder.add(
        linen,
        new THREE.BoxGeometry(0.31, 0.04, 0.26),
        placed(site.x + 0.3, y + 0.22, site.z + 0.45, { z: 0.06 }),
      );
      continue;
    }
    const x = site.x + 1.6,
      z = site.z - 1.6,
      y = terrain.heightAt(x, z);
    if (site.kind === 'camp') {
      builder.add(
        blanket,
        new THREE.BoxGeometry(0.9, 0.07, 0.55),
        placed(x, y + 0.06, z, { y: 0.2 }),
      );
      builder.add(
        blanket,
        new THREE.CylinderGeometry(0.14, 0.14, 0.57, 10).rotateZ(Math.PI / 2),
        placed(x, y + 0.14, z - 0.3),
      );
      for (const dx of [-0.6, 0.6])
        builder.add(
          wood,
          plankGeometry(0.09, 0.65, 0.09, 'y', 1, site.id + dx),
          placed(x + dx, y + 0.32, z - 0.55, { z: dx * 0.15 }),
        );
      // A little timber box and weathered paper read as the place to inspect.
      builder.add(
        wood,
        new THREE.BoxGeometry(0.38, 0.24, 0.3),
        placed(site.x - 0.8, terrain.heightAt(site.x - 0.8, site.z) + 0.12, site.z),
      );
      for (const dx of [-0.13, 0.13]) {
        const boxY = terrain.heightAt(site.x - 0.8, site.z);
        builder.add(
          trim,
          new THREE.BoxGeometry(0.03, 0.26, 0.32),
          placed(site.x - 0.8 + dx, boxY + 0.13, site.z),
        );
      }
      // Narrow bindings keep the worn bedroll readable against the forest floor.
      for (const dx of [-0.22, 0.22])
        builder.add(
          trim,
          new THREE.BoxGeometry(0.03, 0.27, 0.03),
          placed(x + dx, y + 0.15, z - 0.44),
        );
      builder.add(
        linen,
        new THREE.BoxGeometry(0.23, 0.008, 0.2),
        placed(site.x - 0.8, terrain.heightAt(site.x - 0.8, site.z) + 0.249, site.z, { y: 0.2 }),
      );
    } else if (site.kind === 'logging') {
      for (let i = 0; i < 5; i++) {
        const log = logGeometry(1.7, 0.13, { seed: 420 + i, sides: 8 });
        const matrix = placed(x, y + 0.16 + Math.floor(i / 3) * 0.22, z + (i % 3) * 0.26);
        builder.add(bark, log.side, matrix);
        builder.add(cut, log.ends, matrix);
      }
      for (const dx of [-0.6, 0.6])
        builder.add(
          wood,
          new THREE.BoxGeometry(0.12, 0.2, 1.05),
          placed(x + dx, y + 0.08, z + 0.25),
        );
    } else if (site.kind === 'grove') {
      const log = logGeometry(1.75, 0.16, { seed: 601, sides: 8 });
      const matrix = placed(x, y + 0.14, z, { y: 0.4 });
      builder.add(bark, log.side, matrix);
      builder.add(cut, log.ends, matrix);
      builder.add(moss, stoneGeometry(0.3, 0.08, 621), placed(x - 0.4, y + 0.12, z));
      builder.add(
        linen,
        new THREE.BoxGeometry(0.21, 0.008, 0.18),
        placed(site.x + 0.4, terrain.heightAt(site.x + 0.4, site.z) + 0.025, site.z),
      );
    } else {
      builder.add(moss, plankGeometry(0.65, 0.42, 0.6, 'x', 0.8, 801), placed(x, y + 0.21, z));
      builder.add(moss, plankGeometry(0.95, 0.16, 0.85, 'x', 0.8, 802), placed(x, y + 0.5, z));
      builder.add(linen, new THREE.BoxGeometry(0.2, 0.015, 0.16), placed(x - 0.12, y + 0.59, z));
      const bowl = new THREE.CylinderGeometry(0.12, 0.08, 0.07, 10);
      builder.add(wood, bowl, placed(x + 0.15, y + 0.615, z + 0.07));
    }
  }
  const model = builder.build();
  model.group.name = 'discovery-landmarks';
  return model;
}
