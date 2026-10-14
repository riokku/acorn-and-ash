import {
  PLAYER_RADIUS,
  PICKUP_REACH,
  buildTestClearing,
  colliderFootprintRadius,
} from '@acorn/shared';

type Point = { readonly x: number; readonly z: number };
const obstaclesBySeed = new Map<number, readonly (Point & { radius: number })[]>();

/** Choose a dry next waypoint for the real-input test walker around the pond. */
export function pondWaypoint(start: Point, goal: Point, seed: number): Point {
  let all = obstaclesBySeed.get(seed);
  if (all === undefined) {
    all = buildTestClearing(seed).colliders.map((c) => ({
      x: c.x,
      z: c.z,
      radius: colliderFootprintRadius(c),
    }));
    obstaclesBySeed.set(seed, all);
  }
  const obstacles = all.filter(
    (c) =>
      c.x + c.radius > Math.min(start.x, goal.x) - 3 &&
      c.x - c.radius < Math.max(start.x, goal.x) + 3 &&
      c.z + c.radius > Math.min(start.z, goal.z) - 3 &&
      c.z - c.radius < Math.max(start.z, goal.z) + 3,
  );
  const clear = (a: Point, b: Point): boolean =>
    obstacles.every((circle) => {
      const dx = b.x - a.x,
        dz = b.z - a.z;
      const length = dx * dx + dz * dz;
      const t =
        length === 0
          ? 0
          : Math.max(0, Math.min(1, ((circle.x - a.x) * dx + (circle.z - a.z) * dz) / length));
      return (
        Math.hypot(a.x + dx * t - circle.x, a.z + dz * t - circle.z) >=
        circle.radius + PLAYER_RADIUS - 0.03
      );
    });
  if (clear(start, goal)) return goal;
  const nodes: Point[] = [start, goal];
  for (const circle of obstacles) {
    for (let step = 0; step < 32; step++) {
      const angle = (step * Math.PI * 2) / 32;
      const radius = circle.radius + PLAYER_RADIUS + 0.45;
      const point = {
        x: circle.x + Math.cos(angle) * radius,
        z: circle.z + Math.sin(angle) * radius,
      };
      if (clear(point, point)) nodes.push(point);
    }
  }
  const distance = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  distance[0] = 0;
  for (let step = 0; step < nodes.length; step++) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++)
      if (!visited.has(i) && (current < 0 || distance[i]! < distance[current]!)) current = i;
    if (current < 0 || distance[current] === Infinity) break;
    if (current === 1) {
      let next = 1;
      while (previous[next] !== 0 && previous[next] !== -1) next = previous[next]!;
      return nodes[next]!;
    }
    visited.add(current);
    for (let i = 1; i < nodes.length; i++) {
      if (visited.has(i)) continue;
      const a = nodes[current]!,
        b = nodes[i]!;
      const gap = Math.hypot(a.x - b.x, a.z - b.z);
      // A reed inside the water only needs a waypoint within hand reach.
      if (!clear(a, b) && !(i === 1 && gap < PICKUP_REACH - 0.5)) continue;
      const candidate = distance[current]! + gap;
      if (candidate < distance[i]!) {
        distance[i] = candidate;
        previous[i] = current;
      }
    }
  }
  return goal;
}
