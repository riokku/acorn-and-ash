import * as THREE from 'three/webgpu';

/** Close the terrain's underside at its perimeter; cracks in dug lining must see earth, not sky. */
export function createUnderground(geometry: THREE.BufferGeometry, size: number): THREE.Group {
  const group = new THREE.Group();
  const under = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ color: 0x4a3524, side: THREE.BackSide, fog: false }),
  );
  const positions = geometry.getAttribute('position');
  let bottom = -40;
  for (let i = 0; i < positions.count; i++) bottom = Math.min(bottom, positions.getY(i) - 20);
  const vertices: number[] = [];
  const triangle = (a: number[], b: number[], c: number[]) => vertices.push(...a, ...b, ...c);
  // Use the actual outer heights, including slopes, so the enclosure never rises above the ground.
  for (const axis of ['x', 'z'] as const)
    for (const sign of [-1, 1]) {
      const edge = new Map<number, number[]>();
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i),
          y = positions.getY(i),
          z = positions.getZ(i);
        if (Math.abs((axis === 'x' ? x : z) - (sign * size) / 2) > 0.001) continue;
        edge.set(axis === 'x' ? z : x, [x, y, z]);
      }
      const points = [...edge].sort((a, b) => a[0] - b[0]).map(([, p]) => p);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!,
          b = points[i]!;
        const lowA = [a[0]!, bottom, a[2]!],
          lowB = [b[0]!, bottom, b[2]!];
        triangle(a, lowA, b);
        triangle(b, lowA, lowB);
      }
    }
  const h = size / 2;
  triangle([-h, bottom, -h], [-h, bottom, h], [h, bottom, -h]);
  triangle([h, bottom, -h], [-h, bottom, h], [h, bottom, h]);
  const enclosure = new THREE.BufferGeometry();
  enclosure.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  const shell = new THREE.Mesh(
    enclosure,
    new THREE.MeshBasicMaterial({ color: 0x1c140d, side: THREE.DoubleSide, fog: false }),
  );
  group.add(under, shell);
  return group;
}
