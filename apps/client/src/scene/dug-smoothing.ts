/**
 * Takes the stair-steps out of the smooth lining of dug holes (decision 0114).
 *
 * The inside of a hole starts as the blocky faces of the ground round it, cut
 * small, so a ramp dug down in half-metre steps comes out as a staircase and
 * every corner is square. Faces that meet share their corners, so together they
 * are one connected, watertight surface; here that surface is relaxed (Taubin
 * smoothing: a step inwards, then a smaller step back out, so a tunnel does not
 * shrink as it softens). The open edges of the surface, where a hole comes up to
 * the ground, are only smoothed along themselves, so a square rim rounds off.
 */

/** How far each point moves towards the middle of its neighbours, then back. */
const SHRINK = 0.5;
const GROW = -0.53;

export interface LiningSurface {
  /** x, y, z of every vertex, flat. Smoothed in place. */
  readonly positions: number[];
  /** Normals, flat, same layout. Rewritten for the smoothed vertices. */
  readonly normals: number[];
  /** Triangles of the lining, three vertex numbers each. */
  readonly indices: number[];
}

/** Millimetre keys, so corners that are the same point in two pieces are found as one. */
function pointKey(x: number, y: number, z: number): string {
  return `${Math.round(x * 1000)},${Math.round(y * 1000)},${Math.round(z * 1000)}`;
}

export function smoothLining(surface: LiningSurface, passes: number): void {
  const { positions, normals, indices } = surface;
  if (indices.length === 0 || passes <= 0) return;

  // One number for every distinct point, and the vertices that sit on it.
  const ids = new Map<string, number>();
  const members: number[][] = [];
  const idOf = new Map<number, number>();
  for (const vertex of new Set(indices)) {
    const key = pointKey(
      positions[vertex * 3]!,
      positions[vertex * 3 + 1]!,
      positions[vertex * 3 + 2]!,
    );
    let id = ids.get(key);
    if (id === undefined) {
      id = members.length;
      ids.set(key, id);
      members.push([]);
    }
    members[id]!.push(vertex);
    idOf.set(vertex, id);
  }

  // Which points touch which, and which edges belong to only one triangle.
  const neighbours: Set<number>[] = members.map(() => new Set<number>());
  const edgeUses = new Map<number, number>();
  const edgeKey = (a: number, b: number): number => (a < b ? a * 4_000_003 + b : b * 4_000_003 + a);
  for (let t = 0; t < indices.length; t += 3) {
    const corner = [idOf.get(indices[t]!)!, idOf.get(indices[t + 1]!)!, idOf.get(indices[t + 2]!)!];
    for (let e = 0; e < 3; e++) {
      const a = corner[e]!;
      const b = corner[(e + 1) % 3]!;
      if (a === b) continue;
      neighbours[a]!.add(b);
      neighbours[b]!.add(a);
      const key = edgeKey(a, b);
      edgeUses.set(key, (edgeUses.get(key) ?? 0) + 1);
    }
  }
  // The open edges of the surface: a point on one has only the points along that edge as neighbours.
  const rim: (Set<number> | undefined)[] = members.map(() => undefined);
  for (const [key, uses] of edgeUses) {
    if (uses !== 1) continue;
    const a = Math.floor(key / 4_000_003);
    const b = key % 4_000_003;
    (rim[a] ??= new Set<number>()).add(b);
    (rim[b] ??= new Set<number>()).add(a);
  }

  const count = members.length;
  const at = new Float64Array(count * 3);
  for (let id = 0; id < count; id++) {
    const vertex = members[id]![0]!;
    at[id * 3] = positions[vertex * 3]!;
    at[id * 3 + 1] = positions[vertex * 3 + 1]!;
    at[id * 3 + 2] = positions[vertex * 3 + 2]!;
  }
  const next = new Float64Array(count * 3);
  const relax = (amount: number): void => {
    for (let id = 0; id < count; id++) {
      const near = rim[id] ?? neighbours[id]!;
      if (near.size === 0) {
        for (let axis = 0; axis < 3; axis++) next[id * 3 + axis] = at[id * 3 + axis]!;
        continue;
      }
      for (let axis = 0; axis < 3; axis++) {
        let sum = 0;
        for (const other of near) sum += at[other * 3 + axis]!;
        const middle = sum / near.size;
        next[id * 3 + axis] = at[id * 3 + axis]! + amount * (middle - at[id * 3 + axis]!);
      }
    }
    at.set(next);
  };
  for (let pass = 0; pass < passes; pass++) {
    relax(SHRINK);
    relax(GROW);
  }

  for (let id = 0; id < count; id++) {
    for (const vertex of members[id]!) {
      positions[vertex * 3] = at[id * 3]!;
      positions[vertex * 3 + 1] = at[id * 3 + 1]!;
      positions[vertex * 3 + 2] = at[id * 3 + 2]!;
    }
  }

  // New normals: the area-weighted average of the faces round each point.
  const sums = new Float64Array(count * 3);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t]!;
    const b = indices[t + 1]!;
    const c = indices[t + 2]!;
    const ux = positions[b * 3]! - positions[a * 3]!;
    const uy = positions[b * 3 + 1]! - positions[a * 3 + 1]!;
    const uz = positions[b * 3 + 2]! - positions[a * 3 + 2]!;
    const vx = positions[c * 3]! - positions[a * 3]!;
    const vy = positions[c * 3 + 1]! - positions[a * 3 + 1]!;
    const vz = positions[c * 3 + 2]! - positions[a * 3 + 2]!;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    for (const vertex of [a, b, c]) {
      const id = idOf.get(vertex)!;
      sums[id * 3] = sums[id * 3]! + nx;
      sums[id * 3 + 1] = sums[id * 3 + 1]! + ny;
      sums[id * 3 + 2] = sums[id * 3 + 2]! + nz;
    }
  }
  for (let id = 0; id < count; id++) {
    const length = Math.hypot(sums[id * 3]!, sums[id * 3 + 1]!, sums[id * 3 + 2]!);
    if (length === 0) continue;
    for (const vertex of members[id]!) {
      normals[vertex * 3] = sums[id * 3]! / length;
      normals[vertex * 3 + 1] = sums[id * 3 + 1]! / length;
      normals[vertex * 3 + 2] = sums[id * 3 + 2]! / length;
    }
  }
}
