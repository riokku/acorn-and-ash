import type { RestingPlace } from './home';

export interface BenchPlacement {
  readonly id: number;
  readonly kind: string;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
}

export interface BenchSeat extends RestingPlace {
  readonly benchId: number;
  readonly slot: number;
}

/** Two seats, each with a clear standing position in front of the existing bench model. */
export function benchSeats(
  bench: Omit<BenchPlacement, 'kind'>,
  heightAt: (x: number, z: number) => number,
): BenchSeat[] {
  const c = Math.cos(bench.yaw),
    s = Math.sin(bench.yaw);
  const point = (x: number, z: number) => ({
    x: bench.x + x * c + z * s,
    z: bench.z - x * s + z * c,
    yaw: bench.yaw,
  });
  const y = heightAt(bench.x, bench.z);
  return [-0.42, 0.42].map((x, slot) => ({
    kind: 'chair',
    benchId: bench.id,
    slot,
    stand: point(x, -0.82),
    // The chair clip's hips sit about 30 cm above its root.
    rest: { ...point(x, -0.24), y: y + 0.18 },
  }));
}

export function outdoorSeatInReach(
  pieces: readonly BenchPlacement[],
  at: { readonly x: number; readonly y: number; readonly z: number },
  heightAt: (x: number, z: number) => number,
  available: (seat: BenchSeat) => boolean = () => true,
  reach = 0.9,
): BenchSeat | null {
  let nearest: BenchSeat | null = null,
    distance = reach;
  for (const piece of pieces) {
    if (piece.kind !== 'cedarBench') continue;
    if (Math.hypot(at.x - piece.x, at.z - piece.z) > 2) continue;
    for (const seat of benchSeats(piece, heightAt)) {
      const gap = Math.hypot(at.x - seat.stand.x, at.z - seat.stand.z);
      if (Math.abs(at.y - heightAt(seat.stand.x, seat.stand.z)) > 0.5) continue;
      if (gap <= distance && available(seat)) {
        nearest = seat;
        distance = gap;
      }
    }
  }
  return nearest;
}
