import * as THREE from 'three/webgpu';
import { color, texture } from 'three/tsl';
import { artTexture } from '../art/textures';
import { homeOuterScale } from '@acorn/shared';
import { paintedMaterial, plainMaterial } from '../art/materials';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';
import type { Cabin } from './cabin';

/** Original canvas shelters: shaped panels, stitched seams, poles, ropes and pegged hems. */
export function createShelter(kind: 'tent' | 'teepee'): Cabin {
  const scale = homeOuterScale(kind);
  const doorX = -0.575 * scale;
  const depth = 2.05 * scale;
  const builder = new ModelBuilder();
  const canvas = createCanvasMaterial(kind);
  const hem = paintedMaterial('burlap', { tint: 0xa38b63, roughness: 1 });
  const wood = paintedMaterial('wood', { tint: 0xab8152, roughness: 0.9 });
  const rope = plainMaterial(0xdac5a0, { roughness: 1 });
  const brass = plainMaterial(0x9c793e, { roughness: 0.45 });
  const iron = plainMaterial(0x45483c, { roughness: 0.65 });
  const glow = plainMaterial(0xffdaa1, {
    roughness: 0.3,
    emissive: 0xffb653,
    emissiveIntensity: 1,
  });
  const group = new THREE.Group();
  group.name = kind;
  type Point = readonly [number, number, number];
  const panel = (a: Point, b: Point, c: Point, material: THREE.Material = canvas): void => {
    builder.add(material, fabricTriangle(a, b, c));
  };
  const line = (a: Point, b: Point, radius: number, material: THREE.Material): void => {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b);
    const direction = end.clone().sub(start);
    const matrix = new THREE.Matrix4().compose(
      start.add(end).multiplyScalar(0.5),
      new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        direction.clone().normalize(),
      ),
      new THREE.Vector3(1, 1, 1),
    );
    builder.add(
      material,
      new THREE.CylinderGeometry(radius, radius * 1.06, direction.length(), 5),
      matrix,
    );
  };
  const peg = (x: number, z: number): void => {
    builder.add(
      wood,
      new THREE.CylinderGeometry(0.035, 0.05, 0.28, 5),
      placed(x, 0.09, z, { z: 0.15 }),
    );
    builder.add(
      brass,
      new THREE.TorusGeometry(0.045, 0.012, 4, 8),
      placed(x, 0.18, z, { x: Math.PI / 2 }),
    );
  };
  if (kind === 'tent') {
    const left = -1.3,
      right = 1.54,
      ridge = 2.12;
    const lf: Point = [left, 0.07, depth],
      rf: Point = [right, 0.07, depth];
    const lb: Point = [left, 0.07, -depth],
      rb: Point = [right, 0.07, -depth];
    const peakF: Point = [doorX, ridge, depth],
      peakB: Point = [doorX, ridge, -depth];
    panel(lf, lb, peakB);
    panel(lf, peakB, peakF);
    panel(rf, peakF, peakB);
    panel(rf, peakB, rb);
    panel(lb, rb, peakB);
    // Folded front flaps leave a real, visible entrance.
    const dl: Point = [doorX - 0.43, 0.07, depth + 0.01];
    const dr: Point = [doorX + 0.43, 0.07, depth + 0.01];
    const top: Point = [doorX, 1.48, depth + 0.015];
    panel(lf, dl, top);
    panel(lf, top, peakF);
    panel(dr, rf, peakF);
    panel(dr, peakF, top);
    line(lf, peakF, 0.012, hem);
    line(rf, peakF, 0.012, hem);
    line(lb, peakB, 0.014, hem);
    line(rb, peakB, 0.014, hem);
    line(peakB, peakF, 0.028, wood);
    for (const z of [-depth, depth]) {
      for (const side of [-1, 1])
        line([doorX + side * 0.5, 0.05, z], [doorX, ridge + 0.14, z], 0.035, wood);
      line([doorX, ridge - 0.02, z], [doorX, 0.08, z * 1.4], 0.012, rope);
      peg(doorX, z * 1.4);
    }
    for (const x of [left, right])
      for (const z of [-depth * 0.7, depth * 0.7]) {
        const anchor = x + (x < 0 ? -0.15 : 0.15);
        line([x, 0.18, z], [anchor, 0.1, z], 0.012, rope);
        peg(anchor, z);
        builder.add(hem, new THREE.BoxGeometry(0.13, 0.12, 0.1), placed(x, 0.12, z));
      }
  } else {
    const panels = 16,
      peak: Point = [doorX, 3.36, -0.08];
    const rim = (angle: number): Point => [
      0.16 + Math.sin(angle) * 1.83,
      0.07,
      Math.cos(angle) * depth,
    ];
    for (let i = 1; i < panels - 1; i++) {
      const a = rim((i * Math.PI * 2) / panels),
        b = rim(((i + 1) * Math.PI * 2) / panels);
      panel(a, b, peak);
      line(a, peak, 0.009, hem);
      line(a, b, 0.025, hem);
      if (i % 2 === 0) {
        const beyond: Point = [
          peak[0] + (peak[0] - a[0]) * 0.16,
          peak[1] + 0.48,
          peak[2] + (peak[2] - a[2]) * 0.16,
        ];
        line(a, beyond, 0.035, wood);
        peg(a[0], a[2]);
      }
    }
    // The forward two panels fold aside around the shared doorway.
    const top: Point = [doorX, 1.95, depth * 0.72];
    const dl: Point = [doorX - 0.43, 0.07, depth];
    const dr: Point = [doorX + 0.43, 0.07, depth];
    panel(rim((Math.PI * 2) / panels), dr, top);
    panel(rim((Math.PI * 2) / panels), top, peak);
    panel(dl, rim(((panels - 1) * Math.PI * 2) / panels), peak);
    panel(dl, peak, top);
    line(dl, top, 0.016, hem);
    line(dr, top, 0.016, hem);
    for (let i = 0; i < 3; i++)
      builder.add(
        rope,
        new THREE.TorusGeometry(0.15 + i * 0.015, 0.018, 4, 12),
        placed(doorX, 3.15 + i * 0.06, -0.08, { x: Math.PI / 2 }),
      );
  }
  // Low canvas floor, a little stitched doormat, and a warm entrance lantern.
  builder.add(
    hem,
    plankGeometry(1.05, 0.025, 0.46, 'z', 0.4, 902),
    placed(doorX, 0.018, depth + 0.14),
  );
  const lx = doorX + 0.72,
    lz = depth + 0.02;
  builder.add(wood, new THREE.CylinderGeometry(0.035, 0.05, 0.94, 6), placed(lx, 0.47, lz));
  builder.add(iron, new THREE.BoxGeometry(0.25, 0.05, 0.23), placed(lx, 0.67, lz));
  builder.add(glow, new THREE.BoxGeometry(0.16, 0.22, 0.14), placed(lx, 0.81, lz));
  builder.add(
    iron,
    new THREE.ConeGeometry(0.18, 0.13, 4),
    placed(lx, 0.975, lz, { y: Math.PI / 4 }),
  );
  for (const dx of [-0.09, 0.09])
    for (const dz of [-0.08, 0.08])
      builder.add(
        brass,
        new THREE.CylinderGeometry(0.012, 0.012, 0.25, 4),
        placed(lx + dx, 0.81, lz + dz),
      );
  const built = builder.build();
  group.add(built.group);
  return {
    group,
    dispose() {
      built.dispose();
      canvas.dispose();
    },
  };
}

/** Folded canvas surface with enough vertices to catch soft light without a dense mesh. */
export function fabricTriangle(
  a: readonly number[],
  b: readonly number[],
  c: readonly number[],
): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c], 3));
  geometry.setAttribute(
    'uv',
    new THREE.Float32BufferAttribute(
      [0, 0, Math.hypot(b[0]! - a[0]!, b[2]! - a[2]!), 0, 0.5, Math.abs(c[1]! - a[1]!)],
      2,
    ),
  );
  geometry.computeVertexNormals();
  return geometry;
}

export function createCanvasMaterial(kind: 'tent' | 'teepee'): THREE.MeshStandardNodeMaterial {
  const material = new THREE.MeshStandardNodeMaterial({ roughness: 1, side: THREE.DoubleSide });
  // A pale linen base keeps the woven texture from turning a whole shelter brown.
  material.colorNode = texture(artTexture('burlap'))
    .rgb.mul(0.32)
    .add(color(kind === 'tent' ? 0x9b987f : 0xb8aa91));
  return material;
}
