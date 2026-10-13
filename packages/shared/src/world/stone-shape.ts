import { createRng } from '../rng';

/** The existing low-poly stone's triangles, shared by rendering and collision. */
export function stonePositions(
  radius: number,
  height: number,
  seed: number,
  detail = 1,
): Float32Array {
  const values = sphereTemplate(detail);
  const random = createRng(seed).nextFloat;
  const stretchX = 1 + (random() - 0.5) * 0.5,
    stretchZ = 1 + (random() - 0.5) * 0.5;
  const bumps = new Map<string, number>();
  const positions = Float32Array.from(values, (value) => value * radius);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i]!,
      y = positions[i + 1]!,
      z = positions[i + 2]!;
    const key = `${x.toFixed(4)},${y.toFixed(4)},${z.toFixed(4)}`;
    let bump = bumps.get(key);
    if (bump === undefined) {
      bump = 1 + (random() - 0.5) * 0.35;
      bumps.set(key, bump);
    }
    positions[i] = x * bump * stretchX;
    positions[i + 1] = y * bump * (height / radius) * (y < 0 ? 0.25 : 1) + height * 0.25;
    positions[i + 2] = z * bump * stretchZ;
  }
  return positions;
}

const sphereTemplates = new Map<number, readonly number[]>();
function sphereTemplate(detail: number): readonly number[] {
  const cached = sphereTemplates.get(detail);
  if (cached !== undefined) return cached;
  const t = (1 + Math.sqrt(5)) / 2;
  const corners = [
    [-1, t, 0],
    [1, t, 0],
    [-1, -t, 0],
    [1, -t, 0],
    [0, -1, t],
    [0, 1, t],
    [0, -1, -t],
    [0, 1, -t],
    [t, 0, -1],
    [t, 0, 1],
    [-t, 0, -1],
    [-t, 0, 1],
  ];
  const faces = [
    0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1,
    8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1,
  ];
  const values: number[] = [];
  const cols = detail + 1;
  const mix = (a: number[], b: number[], amount: number) =>
    a.map((value, i) => value + (b[i]! - value) * amount);
  const append = (point: number[]) => {
    const size = Math.hypot(...point);
    for (const value of point) values.push(value / size);
  };
  for (let face = 0; face < faces.length; face += 3) {
    const a = corners[faces[face]!]!,
      b = corners[faces[face + 1]!]!,
      c = corners[faces[face + 2]!]!;
    const rows: number[][][] = [];
    for (let i = 0; i <= cols; i++) {
      const left = mix(a, c, i / cols),
        right = mix(b, c, i / cols);
      rows.push(
        Array.from({ length: cols - i + 1 }, (_, j) =>
          i === cols ? left : mix(left, right, j / (cols - i)),
        ),
      );
    }
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 2 * (cols - i) - 1; j++) {
        const k = Math.floor(j / 2);
        append(rows[i]![k + 1]!);
        append(j % 2 === 0 ? rows[i + 1]![k]! : rows[i + 1]![k + 1]!);
        append(j % 2 === 0 ? rows[i]![k]! : rows[i + 1]![k]!);
      }
    }
  }
  sphereTemplates.set(detail, values);
  return values;
}

/** The existing stump's bark rings and sawn cap, for solid roots and a matching top. */
export function stumpPositions(radius: number, height: number): Float32Array {
  const sides = 10;
  const rings = [
    { y: -0.02, r: 1.28 },
    { y: 0.08, r: 1.08 },
    { y: 0.35, r: 0.98 },
    { y: 1, r: 0.94 },
  ];
  const vertices = rings.map((ring, index) =>
    Array.from({ length: sides + 1 }, (_, corner) => {
      const angle = (corner / sides) * Math.PI * 2;
      const root = index === 0 ? 1 + 0.25 * Math.max(0, Math.cos(angle * 3 + 0.4)) : 1;
      const r = radius * ring.r * root * (1 + 0.04 * Math.sin(angle * 5 + index * 2.1));
      return [Math.cos(angle) * r, ring.y * height, Math.sin(angle) * r];
    }),
  );
  const triangles: number[] = [];
  for (let ring = 0; ring < rings.length - 1; ring++)
    for (let corner = 0; corner < sides; corner++) {
      triangles.push(
        ...vertices[ring]![corner]!,
        ...vertices[ring + 1]![corner]!,
        ...vertices[ring]![corner + 1]!,
      );
      triangles.push(
        ...vertices[ring]![corner + 1]!,
        ...vertices[ring + 1]![corner]!,
        ...vertices[ring + 1]![corner + 1]!,
      );
    }
  for (let corner = 0; corner < sides; corner++) {
    const a = (corner / sides) * Math.PI * 2,
      b = ((corner + 1) / sides) * Math.PI * 2;
    triangles.push(
      0,
      height,
      0,
      Math.cos(a) * radius * 0.94,
      height,
      Math.sin(a) * radius * 0.94,
      Math.cos(b) * radius * 0.94,
      height,
      Math.sin(b) * radius * 0.94,
    );
  }
  return new Float32Array(triangles);
}
