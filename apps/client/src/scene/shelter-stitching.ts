import * as THREE from 'three/webgpu';
import { type ModelBuilder, placed } from '../art/shapes';

type Point = readonly [number, number, number];

/** Reinforcement tape and little thread bars follow the existing cloth's pinned edges. */
export function addShelterStitching(
  builder: ModelBuilder,
  kind: 'tent' | 'teepee',
  doorX: number,
  depth: number,
  materials: {
    hem: THREE.Material;
    thread: THREE.Material;
    wood: THREE.Material;
  },
) {
  const strip = (
    a: THREE.Vector3,
    b: THREE.Vector3,
    normal: THREE.Vector3,
    width: number,
    material: THREE.Material,
  ) => {
    const side = b
      .clone()
      .sub(a)
      .normalize()
      .cross(normal)
      .normalize()
      .multiplyScalar(width / 2);
    const points = [
      a.clone().add(side),
      b.clone().add(side),
      b.clone().sub(side),
      a.clone().sub(side),
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        points.flatMap((p) => p.toArray()),
        3,
      ),
    );
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 0, 1, 1, 1, 1, 0], 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    geometry.computeVertexNormals();
    builder.add(material, geometry);
  };
  const seam = (start: Point, end: Point, outward: Point, width = 0.045) => {
    const normal = new THREE.Vector3(...outward).normalize();
    const a = new THREE.Vector3(...start).addScaledVector(normal, 0.014);
    const b = new THREE.Vector3(...end).addScaledVector(normal, 0.014);
    strip(a, b, normal, width, materials.hem);
    const across = b
      .clone()
      .sub(a)
      .normalize()
      .cross(normal)
      .normalize()
      .multiplyScalar(width * 0.32);
    const count = Math.floor(a.distanceTo(b) / 0.105);
    for (let i = 1; i < count; i++) {
      const center = a
        .clone()
        .lerp(b, i / count)
        .addScaledVector(normal, 0.003);
      strip(
        center.clone().sub(across),
        center.clone().add(across),
        normal,
        0.006,
        materials.thread,
      );
    }
  };
  if (kind === 'tent') {
    const lf: Point = [-1.3, 0.07, depth],
      rf: Point = [1.54, 0.07, depth];
    const lb: Point = [-1.3, 0.07, -depth],
      rb: Point = [1.54, 0.07, -depth];
    const pf: Point = [doorX, 2.12, depth],
      pb: Point = [doorX, 2.12, -depth];
    seam(lf, pf, [0, 0, 1]);
    seam(rf, pf, [0, 0, 1]);
    seam(lb, pb, [0, 0, -1]);
    seam(rb, pb, [0, 0, -1]);
    seam(lf, lb, [-1, 0.4, 0], 0.065);
    seam(rf, rb, [1, 0.8, 0], 0.065);
    // The long diagonal is an actual join between the two shaped canvas panels.
    seam(lf, pb, [-1, 0.4, 0], 0.035);
    seam(rf, pb, [1, 0.8, 0], 0.035);
    const top: Point = [doorX, 1.48, depth + 0.015];
    seam([doorX - 0.43, 0.07, depth + 0.01], top, [0, 0, 1], 0.055);
    seam([doorX + 0.43, 0.07, depth + 0.01], top, [0, 0, 1], 0.055);
  } else {
    const peak: Point = [doorX, 3.36, -0.08];
    const rim = (i: number): Point => [
      0.16 + Math.sin((i * Math.PI * 2) / 16) * 1.83,
      0.07,
      Math.cos((i * Math.PI * 2) / 16) * depth,
    ];
    for (let i = 1; i < 15; i++) {
      const a = rim(i),
        b = rim(i + 1);
      const outward: Point = [a[0] - 0.16, 0.3, a[2]];
      seam(a, b, [a[0] + b[0] - 0.32, 0.1, a[2] + b[2]], 0.075);
      // Alternating broad seams keep the cone readable at a distance.
      if (i % 2 === 1) seam(a, peak, outward, 0.045);
    }
    seam([doorX - 0.43, 0.07, depth], [doorX, 1.95, depth * 0.72], [0, 0.3, 1], 0.06);
    seam([doorX + 0.43, 0.07, depth], [doorX, 1.95, depth * 0.72], [0, 0.3, 1], 0.06);
  }
  // Wooden toggles tie the opening back; no loose cord crosses the entrance.
  for (const side of [-1, 1]) {
    const openingHeight = (0.66 - 0.07) / (1.95 - 0.07);
    const x =
      kind === 'tent' ? doorX + side * 0.57 : doorX + side * (0.43 * (1 - openingHeight) + 0.03);
    const z = kind === 'tent' ? depth + 0.035 : depth * (1 - 0.28 * openingHeight) + 0.025;
    builder.add(materials.thread, new THREE.TorusGeometry(0.047, 0.009, 4, 10), placed(x, 0.66, z));
    builder.add(
      materials.wood,
      new THREE.CylinderGeometry(0.017, 0.021, 0.14, 5),
      placed(x, 0.66, z + 0.012, { z: Math.PI / 2 + side * 0.16 }),
    );
  }
}
