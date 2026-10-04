import { createSentinelTrophy } from './sentinel-art';
import * as THREE from 'three/webgpu';
import { ModelBuilder, placed } from '../art/shapes';
import { paintedMaterial } from '../art/materials';
import type { DecorationKind } from '@acorn/shared';
import { createLantern } from './lantern';
import { createGuardianTrophy } from './guardian-trophy';
export function createHomeDecoration(kind: DecorationKind) {
  if (kind === 'sentinelTrophy') return createSentinelTrophy();
  if (kind === 'lantern') return createLantern();
  if (kind === 'fernLantern') return createLantern('fern');
  if (kind === 'moonLantern') return createLantern('moonlight');
  if (kind === 'guardianTrophy') return createGuardianTrophy();
  const wood = paintedMaterial('wood', { tint: 0xad875c, roughness: 1 });
  const dark = paintedMaterial('wood', { tint: 0x6f5038, roughness: 1 });
  const green = paintedMaterial('burlap', { tint: 0x689584, roughness: 1 });
  const cream = paintedMaterial('burlap', { tint: 0xd5bd8c, roughness: 1 });
  const b = new ModelBuilder();
  if (kind === 'trailPennant') {
    b.add(dark, new THREE.CylinderGeometry(0.035, 0.045, 1.45, 6), placed(0, 0.725, 0));
    b.add(wood, new THREE.BoxGeometry(0.65, 0.045, 0.045), placed(0.3, 1.35, 0));
    b.add(green, new THREE.BoxGeometry(0.48, 0.48, 0.018), placed(0.3, 1.075, 0));
    b.add(cream, new THREE.BoxGeometry(0.035, 0.42, 0.023), placed(0.09, 1.075, 0));
    for (let i = 0; i < 3; i++)
      b.add(
        cream,
        new THREE.BoxGeometry(0.1, 0.1, 0.023),
        placed(0.3, 1.22 - i * 0.14, 0, { z: Math.PI / 4 }),
      );
  } else if (kind === 'flowerPlanter') {
    const soil = paintedMaterial('soil', { roughness: 1 }),
      leaf = paintedMaterial('grass', { tint: 0x678447, roughness: 1 }),
      petal = paintedMaterial('burlap', { tint: 0xf1dab0, roughness: 1 });
    b.add(dark, new THREE.CylinderGeometry(0.29, 0.2, 0.35, 8), placed(0, 0.175, 0));
    b.add(
      wood,
      new THREE.TorusGeometry(0.285, 0.035, 4, 8),
      placed(0, 0.35, 0, { x: Math.PI / 2 }),
    );
    b.add(soil, new THREE.CylinderGeometry(0.255, 0.255, 0.02, 8), placed(0, 0.342, 0));
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.399963,
        x = Math.cos(angle) * 0.15,
        z = Math.sin(angle) * 0.15,
        top = 0.58 + i * 0.045;
      b.add(
        leaf,
        new THREE.CylinderGeometry(0.009, 0.012, top - 0.33, 5),
        placed(x, (top + 0.33) / 2, z),
      );
      b.add(
        leaf,
        new THREE.SphereGeometry(0.055, 6, 4),
        placed(x + 0.04, 0.47, z, {}, { x: 1.2, y: 0.3, z: 0.6 }),
      );
      for (let pet = 0; pet < 5; pet++) {
        const a = (pet * Math.PI * 2) / 5;
        b.add(
          petal,
          new THREE.SphereGeometry(0.042, 6, 4),
          placed(x + Math.cos(a) * 0.045, top, z + Math.sin(a) * 0.045, {}, { x: 1, y: 0.3, z: 1 }),
        );
      }
      b.add(wood, new THREE.SphereGeometry(0.025, 6, 4), placed(x, top + 0.015, z));
    }
  } else if (kind === 'wovenRug') {
    b.add(green, new THREE.BoxGeometry(1.8, 0.015, 1), placed(0, 0.025, 0));
    for (const side of [-1, 1]) {
      b.add(cream, new THREE.BoxGeometry(0.075, 0.012, 0.88), placed(side * 0.81, 0.037, 0));
      for (let i = 0; i < 12; i++)
        b.add(
          cream,
          new THREE.BoxGeometry(0.14, 0.012, 0.025),
          placed(side * 0.94, 0.025, -0.44 + i * 0.08),
        );
    }
    for (let i = -2; i <= 2; i++) {
      b.add(
        cream,
        new THREE.BoxGeometry(0.14, 0.012, 0.14),
        placed(i * 0.24, 0.039, 0, { y: Math.PI / 4 }),
      );
      b.add(
        dark,
        new THREE.BoxGeometry(0.04, 0.012, 0.04),
        placed(i * 0.24, 0.046, 0, { y: Math.PI / 4 }),
      );
    }
  } else {
    const bench = kind === 'cedarBench',
      width = bench ? 1.7 : 1.15,
      depth = bench ? 0.46 : 0.95,
      top = bench ? 0.44 : 0.74;
    const boards = bench ? 3 : 5;
    for (let i = 0; i < boards; i++)
      b.add(
        i % 2 === 0 ? wood : dark,
        new THREE.BoxGeometry(width, 0.085, depth / boards - 0.015),
        placed(0, top, -depth / 2 + ((i + 0.5) * depth) / boards),
      );
    for (const x of [-1, 1])
      for (const z of [-1, 1]) {
        b.add(
          dark,
          new THREE.BoxGeometry(0.13, top - 0.08, 0.13),
          placed(x * (width / 2 - 0.13), (top - 0.08) / 2, z * (depth / 2 - 0.09), {
            z: x * 0.045,
          }),
        );
        b.add(
          wood,
          new THREE.CylinderGeometry(0.022, 0.022, 0.016, 6),
          placed(x * (width / 2 - 0.13), top + 0.052, z * (depth / 2 - 0.09)),
        );
      }
    b.add(dark, new THREE.BoxGeometry(width - 0.2, 0.08, 0.09), placed(0, 0.17, 0));
    if (bench) b.add(wood, new THREE.BoxGeometry(1.5, 0.07, 0.35), placed(0, 0.21, 0));
    else {
      b.add(
        dark,
        new THREE.BoxGeometry(width - 0.15, 0.12, 0.065),
        placed(0, top - 0.13, -depth / 2 + 0.05),
      );
      b.add(
        dark,
        new THREE.BoxGeometry(width - 0.15, 0.12, 0.065),
        placed(0, top - 0.13, depth / 2 - 0.05),
      );
    }
  }
  return b.build();
}
