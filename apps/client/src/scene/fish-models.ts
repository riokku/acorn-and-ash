import * as THREE from 'three/webgpu';
import type { ModelPart } from './model-loading';

type Species = 'perch' | 'trout' | 'goldenCarp';

/** Small, closed low-poly fish; head faces -Z, preserving the existing food grip. */
export function createFishParts(species: Species, roasted = false): ModelPart[] {
  const carp = species === 'goldenCarp';
  const trout = species === 'trout';
  const depth = carp ? 1.22 : trout ? 0.82 : 1;
  const width = carp ? 1.13 : trout ? 0.9 : 1;
  const back = new THREE.Color(roasted ? 0x67432b : carp ? 0x88632a : trout ? 0x455c56 : 0x48592e);
  const flank = new THREE.Color(roasted ? 0xb47d45 : carp ? 0xd6aa4e : trout ? 0x9aafa7 : 0x9aab5a);
  const belly = new THREE.Color(roasted ? 0xd5ad71 : carp ? 0xf1d893 : 0xdce0bc);
  const finMaterial = new THREE.MeshStandardMaterial({
    color: roasted ? 0x704728 : carp ? 0xb67c30 : trout ? 0x697c70 : 0xae753e,
    roughness: roasted ? 0.92 : 0.65,
    flatShading: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: roasted ? 0x38271c : 0x263b33,
    roughness: 0.8,
  });
  const parts: ModelPart[] = [];
  // z, half width, half depth: blunt muzzle, shoulders, tapered tail wrist.
  const rings = [
    [-0.17, 0.009, 0.012],
    [-0.15, 0.025, 0.03],
    [-0.105, 0.043, 0.052],
    [-0.045, 0.046, 0.059],
    [0.02, 0.039, 0.05],
    [0.075, 0.025, 0.033],
    [0.12, 0.011, 0.016],
    [0.145, 0.007, 0.013],
  ];
  const positions: number[] = [],
    colors: number[] = [];
  const sides = 12;
  const point = (r: number, a: number) => {
    const ring = rings[r]!;
    const angle = (a / sides) * Math.PI * 2;
    return [Math.cos(angle) * ring[1]! * width, Math.sin(angle) * ring[2]! * depth, ring[0]!];
  };
  function face(points: number[][], color: THREE.Color) {
    for (const p of points) {
      positions.push(...p);
      colors.push(color.r, color.g, color.b);
    }
  }
  for (let r = 0; r < rings.length - 1; r++) {
    for (let a = 0; a < sides; a++) {
      const up = Math.sin(((a + 0.5) / sides) * Math.PI * 2);
      const color = flank.clone().lerp(up > 0 ? back : belly, Math.abs(up) * 0.9);
      if (!roasted && !trout && !carp && r > 1 && r % 2 === 0 && up > -0.45) color.lerp(back, 0.7);
      if (!roasted && trout && Math.abs(up) < 0.3 && r > 1)
        color.lerp(new THREE.Color(0xb78687), 0.5);
      const p = point(r, a),
        q = point(r, a + 1),
        n = point(r + 1, a),
        m = point(r + 1, a + 1);
      face([p, q, n], color);
      face([q, m, n], color);
    }
  }
  for (let a = 0; a < sides; a++) {
    face([[0, 0, rings[0]![0]!], point(0, a + 1), point(0, a)], flank);
    face([[0, 0, rings[7]![0]!], point(7, a), point(7, a + 1)], flank);
  }
  const body = new THREE.BufferGeometry();
  body.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  body.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  body.computeVertexNormals();
  parts.push({
    geometry: body,
    material: new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: roasted ? 0.9 : 0.48,
      metalness: 0.03,
    }),
  });

  // Thin solid fins have a visible edge from either side, including underneath.
  function fin(outline: number[][], x = 0, tilt = 0) {
    const shape = new THREE.Shape();
    outline.forEach(([z, y], i) => (i === 0 ? shape.moveTo(z!, y!) : shape.lineTo(z!, y!)));
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.003,
      bevelEnabled: false,
      steps: 1,
    });
    geometry
      .rotateY(-Math.PI / 2)
      .translate(0.0015, 0, 0)
      .rotateZ(tilt)
      .translate(x, 0, 0);
    parts.push({ geometry, material: finMaterial });
  }
  fin([
    [0.132, 0.012],
    [0.205, 0.068],
    [0.19, 0.018],
    [0.17, 0],
    [0.19, -0.018],
    [0.205, -0.062],
    [0.132, -0.012],
  ]);
  const top = 0.057 * depth;
  fin(
    trout
      ? [
          [-0.055, top],
          [-0.035, top + 0.04],
          [0.025, top * 0.85],
          [0.045, 0.033],
        ]
      : carp
        ? [
            [-0.07, top * 0.95],
            [-0.045, top + 0.027],
            [0.04, top * 0.85],
            [0.08, 0.025],
          ]
        : [
            [-0.1, top * 0.82],
            [-0.08, top + 0.025],
            [-0.065, top + 0.012],
            [-0.047, top + 0.04],
            [-0.03, top + 0.023],
            [-0.01, top + 0.035],
            [0.055, 0.04],
          ],
  );
  fin([
    [0.035, -0.035 * depth],
    [0.075, -0.068 * depth],
    [0.095, -0.02],
  ]);
  if (trout)
    fin([
      [0.075, 0.032],
      [0.09, 0.048],
      [0.108, 0.02],
    ]);
  for (const side of [-1, 1]) {
    fin(
      [
        [-0.085, -0.012],
        [-0.025, -0.055],
        [-0.045, -0.005],
      ],
      side * 0.035 * width,
      side * 0.65,
    );
    const eye = new THREE.SphereGeometry(0.009, 8, 6)
      .scale(0.4, 1, 1)
      .translate(side * 0.03 * width, 0.017 * depth, -0.136);
    parts.push({
      geometry: eye,
      material: new THREE.MeshStandardMaterial({ color: 0xd5b75c, roughness: 0.5 }),
    });
    parts.push({
      geometry: new THREE.SphereGeometry(0.0055, 8, 6)
        .scale(0.35, 1, 1)
        .translate(side * 0.034 * width, 0.017 * depth, -0.136),
      material: dark,
    });
    const gill = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.032 * width, 0.038 * depth, -0.105),
      new THREE.Vector3(side * 0.047 * width, 0, -0.093),
      new THREE.Vector3(side * 0.032 * width, -0.038 * depth, -0.105),
    ]);
    parts.push({ geometry: new THREE.TubeGeometry(gill, 5, 0.0015, 3, false), material: dark });
    if (trout && !roasted) {
      for (let i = 0; i < 12; i++) {
        const r = 2 + (i % 4),
          a =
            side > 0
              ? i < 4
                ? 0.22
                : i < 8
                  ? 0.65
                  : -0.25
              : Math.PI - (i < 4 ? 0.22 : i < 8 ? 0.65 : -0.25);
        const ring = rings[r]!;
        parts.push({
          geometry: new THREE.SphereGeometry(0.0026, 5, 3)
            .scale(0.35, 1, 1)
            .translate(
              Math.cos(a) * ring[1]! * width * 1.015,
              Math.sin(a) * ring[2]! * depth,
              ring[0]!,
            ),
          material: dark,
        });
      }
    }
    if (roasted)
      for (const z of [-0.055, 0.005, 0.06]) {
        const stroke: THREE.Vector3[] = [];
        for (const angle of [-0.55, 0, 0.55]) {
          const at = z + angle * 0.015;
          const r = rings.findIndex((ring) => ring[0]! > at) - 1;
          const left = rings[r]!,
            right = rings[r + 1]!;
          const blend = (at - left[0]!) / (right[0]! - left[0]!);
          const rx = THREE.MathUtils.lerp(left[1]!, right[1]!, blend) * width;
          const ry = THREE.MathUtils.lerp(left[2]!, right[2]!, blend) * depth;
          stroke.push(
            new THREE.Vector3(side * (Math.cos(angle) * rx + 0.0015), Math.sin(angle) * ry, at),
          );
        }
        parts.push({
          geometry: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stroke), 6, 0.002, 3, false),
          material: dark,
        });
      }
  }
  // Small recessed mouth line, rather than a cartoon muzzle.
  parts.push({
    geometry: new THREE.BoxGeometry(0.018 * width, 0.002, 0.002).translate(0, -0.003, -0.171),
    material: dark,
  });
  return parts;
}
