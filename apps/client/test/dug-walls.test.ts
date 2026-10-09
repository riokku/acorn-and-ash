import { describe, expect, it } from 'vitest';

import {
  planWallPieces,
  plansMirror,
  turnPoint,
  WALL_CELL,
  type ClosedSides,
  type WallPiecePlan,
} from '../src/scene/dug-walls';

const SIDES = [
  [0, 0],
  [1, 0],
  [0, 1],
  [1, 1],
] as const;

/** Every way the six sides of a cube can touch solid ground (64 of them). */
function everyClosedSides(): ClosedSides[] {
  const all: ClosedSides[] = [];
  for (const x of SIDES) {
    for (const y of SIDES) {
      for (const z of SIDES) {
        all.push([
          [x[0] === 1, x[1] === 1],
          [y[0] === 1, y[1] === 1],
          [z[0] === 1, z[1] === 1],
        ]);
      }
    }
  }
  return all;
}

const count = (closed: ClosedSides): number => closed.flat().filter(Boolean).length;
const hasOpposite = (closed: ClosedSides): boolean => closed.some(([low, high]) => low && high);

describe('choosing the smooth lining pieces for an open cube', () => {
  it('uses no piece for a cube with nothing solid beside it', () => {
    expect(
      planWallPieces([
        [false, false],
        [false, false],
        [false, false],
      ]),
    ).toEqual([]);
  });

  it('uses one piece for one, two or three solid sides that are not opposite each other', () => {
    for (const closed of everyClosedSides()) {
      if (hasOpposite(closed) || count(closed) === 0) continue;
      const plans = planWallPieces(closed);
      expect(plans).toHaveLength(1);
      expect(plans[0]!.piece).toBe(['dug_panel', 'dug_edge', 'dug_dome'][count(closed) - 1]);
    }
  });

  it('uses a flat wall on every solid side when the cube is a slot between two', () => {
    for (const closed of everyClosedSides()) {
      if (!hasOpposite(closed)) continue;
      const plans = planWallPieces(closed);
      expect(plans).toHaveLength(count(closed));
      expect(plans.every((plan) => plan.piece === 'dug_panel')).toBe(true);
    }
  });

  it('turns every piece to sit on exactly the solid sides', () => {
    const solidSide = (plan: WallPiecePlan, canonical: number, at: number): number =>
      // Where the piece's solid corner point lands on the cell's axis the canonical axis became.
      turnPoint(plan, ...(point(canonical, at) as [number, number, number]))[
        plan.actual[plan.canon.indexOf(canonical)]!
      ]!;
    const point = (canonical: number, at: number): number[] => {
      const p = [WALL_CELL / 2, WALL_CELL / 2, WALL_CELL / 2];
      p[canonical] = at;
      return p;
    };
    for (const closed of everyClosedSides()) {
      for (const plan of planWallPieces(closed)) {
        // The pieces' solid sides are their low sides (coordinate 0): each of the axes the piece
        // is closed on must land on the cell side that really is solid.
        const solidAxes =
          plan.piece === 'dug_panel' ? [1] : plan.piece === 'dug_edge' ? [1, 2] : [1, 2, 0];
        for (const canonical of solidAxes) {
          const axis = plan.actual[plan.canon.indexOf(canonical)]!;
          const landed = solidSide(plan, canonical, 0);
          const side = landed === 0 ? 0 : 1;
          expect(landed === 0 || landed === WALL_CELL).toBe(true);
          expect(closed[axis]![side]).toBe(true);
        }
      }
    }
  });

  it('says a piece is mirrored exactly when the turn flips it inside out', () => {
    // Turning the cell by a plain rotation never mirrors; one flipped axis always does.
    const rotated: WallPiecePlan = {
      piece: 'dug_edge',
      canon: [1, 2, 0],
      actual: [1, 2, 0],
      flips: [false, false, false],
    };
    expect(plansMirror(rotated)).toBe(false);
    expect(plansMirror({ ...rotated, flips: [true, false, false] })).toBe(true);
    expect(plansMirror({ ...rotated, flips: [true, true, false] })).toBe(false);
    // Swapping two axes alone is a mirror too.
    expect(plansMirror({ ...rotated, actual: [2, 1, 0] })).toBe(true);
  });
});
