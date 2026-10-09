import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_WORLD_SEED, HUNGER_MAX } from '../src/constants';
import {
  decodeClientMessage,
  decodeServerMessage,
  encodePlaceSupport,
  encodeSupports,
} from '../src/net/protocol';
import { countOf, removeItem } from '../src/sim/inventory';
import { DIG_REFUSALS } from '../src/sim/digging';
import { WorldSimulation, type PersistedPlayer } from '../src/sim/world-sim';
import { CUBE_DIG, DugGrid, VOXEL } from '../src/world/digging';
import { RECIPES } from '../src/data/recipes';
import {
  SUPPORT_HEIGHT,
  checkSupportCell,
  supportCellAt,
  supportInReach,
  type Support,
} from '../src/world/supports';
import type { Terrain } from '../src/world/terrain';

const flat: Terrain = { kind: 'flat', heightAt: () => 10 };

/** A tunnel a metre wide and two metres tall, three metres down, `length` metres long, along X (or Z). */
function tunnel(grid: DugGrid, length: number, along: 'x' | 'z' = 'x'): void {
  for (let metre = 0; metre < length; metre++) {
    for (const iy of [14, 16]) {
      grid.apply({
        ix: along === 'x' ? metre * 2 : 0,
        iy,
        iz: along === 'z' ? metre * 2 : 0,
        dir: CUBE_DIG,
      });
    }
  }
}

describe('where a mine support can stand', () => {
  it('fits in a tunnel a metre wide, running the way the tunnel runs', () => {
    const along = new DugGrid(flat);
    tunnel(along, 4, 'x');
    expect(checkSupportCell(along, { ix: 2, iy: 14, iz: 0 }, [])).toEqual({ axis: 0 });
    const across = new DugGrid(flat);
    tunnel(across, 4, 'z');
    expect(checkSupportCell(across, { ix: 0, iy: 14, iz: 2 }, [])).toEqual({ axis: 1 });
  });

  it('does not fit in open ground, a wide room or a tunnel with no roof', () => {
    const grid = new DugGrid(flat);
    expect(checkSupportCell(grid, { ix: 2, iy: 14, iz: 0 }, [])).toEqual({ refusal: 'notTunnel' });
    // A room two metres wide: nothing for the posts to stand against.
    tunnel(grid, 4, 'x');
    grid.apply({ ix: 2, iy: 14, iz: 2, dir: CUBE_DIG });
    grid.apply({ ix: 2, iy: 16, iz: 2, dir: CUBE_DIG });
    expect(checkSupportCell(grid, { ix: 2, iy: 14, iz: 0 }, [])).toEqual({ refusal: 'notTunnel' });
    // Dug right up to the sky: no roof to hold up.
    const open = new DugGrid(flat);
    for (const iy of [14, 16, 18])
      for (let metre = 0; metre < 3; metre++)
        open.apply({ ix: metre * 2, iy, iz: 0, dir: CUBE_DIG });
    expect(checkSupportCell(open, { ix: 2, iy: 14, iz: 0 }, [])).toEqual({ refusal: 'notTunnel' });
  });

  it('does not stand twice in one place', () => {
    const grid = new DugGrid(flat);
    tunnel(grid, 4);
    const first: Support = { ix: 2, iy: 14, iz: 0, axis: 0 };
    expect(checkSupportCell(grid, first, [first])).toEqual({ refusal: 'supportTaken' });
  });

  it('is stood where the mouse points: on the floor, or on the wall above it', () => {
    const grid = new DugGrid(flat);
    tunnel(grid, 4);
    // The floor of the tunnel at x = 2.5 m.
    expect(supportCellAt(grid, { x: 2.5, y: 7, z: 0.5 }, { x: 0, y: 1, z: 0 })).toEqual({
      ix: 4,
      iy: 14,
      iz: 0,
    });
    // The side wall, a metre up: the same cell, found by dropping to the floor.
    expect(supportCellAt(grid, { x: 2.5, y: 8, z: 1 }, { x: 0, y: 0, z: -1 })).toEqual({
      ix: 4,
      iy: 14,
      iz: 0,
    });
    // Nothing solid below within a few metres: no cell.
    expect(supportCellAt(grid, { x: 40, y: 30, z: 40 }, { x: 0, y: 1, z: 0 })).toBeNull();
  });

  it('is within reach of the chest, or not', () => {
    const cell = { ix: 2, iy: 14, iz: 0 };
    expect(supportInReach({ x: 2, y: 7, z: 0.5 }, cell, 3)).toBe(true);
    expect(supportInReach({ x: 20, y: 7, z: 0.5 }, cell, 3)).toBe(false);
    expect(SUPPORT_HEIGHT * VOXEL).toBe(2);
  });
});

describe('making mine supports', () => {
  it('costs three logs', () => {
    expect(RECIPES.mineSupport?.costs).toEqual([{ item: 'log', amount: 3 }]);
  });
});

describe('the wire', () => {
  it('round trips a support to place and the supports standing', () => {
    const cell = { ix: -600, iy: 41, iz: 580 };
    expect(decodeClientMessage(encodePlaceSupport(cell))).toEqual({ type: 'placeSupport', cell });
    const supports: Support[] = [
      { ix: 2, iy: 14, iz: 0, axis: 0 },
      { ix: -40, iy: -3, iz: 8, axis: 1 },
    ];
    expect(decodeServerMessage(encodeSupports(supports, true))).toEqual({
      type: 'supports',
      replace: true,
      supports,
    });
    expect(decodeServerMessage(encodeSupports([], false))).toEqual({
      type: 'supports',
      replace: false,
      supports: [],
    });
  });

  it('rejects a short message and a bad axis', () => {
    expect(decodeClientMessage(new Uint8Array([0x10, 1, 0]).buffer)).toBeNull();
    const bad = encodeSupports([{ ix: 0, iy: 0, iz: 0, axis: 0 }], false);
    new DataView(bad).setUint8(10, 2);
    expect(decodeServerMessage(bad)).toBeNull();
  });

  it('tells the placer why a support would not go', () => {
    expect(DIG_REFUSALS).toContain('notTunnel');
    expect(DIG_REFUSALS).toContain('supportTaken');
  });
});

describe('standing a support in the world', () => {
  const built: WorldSimulation[] = [];
  afterEach(() => {
    for (const sim of built.splice(0)) sim.dispose();
  });

  const withSupports = (netId: number, count: number): PersistedPlayer => ({
    netId,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    items: [
      { item: 'bag', count: 1 },
      { item: 'mineSupport', count },
    ],
    hunger: HUNGER_MAX,
  });

  /** A world with a tunnel dug 4 m under some level ground, and a player standing in it. */
  function inATunnel(count: number): {
    sim: WorldSimulation;
    cell: { ix: number; iy: number; iz: number };
  } {
    const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
    built.push(sim);
    sim.addPlayer(1, withSupports(1, count));
    const terrain = sim.collision.terrain;
    // Anywhere high enough that a tunnel five metres down stays well under the ground.
    let spot: { x: number; z: number; low: number } | null = null;
    for (let x = -480; x < 480 && spot === null; x += 6) {
      for (let z = -480; z < 480 && spot === null; z += 6) {
        let low = Infinity;
        for (let dx = -2; dx <= 8; dx += 2)
          for (let dz = -2; dz <= 2; dz += 2)
            low = Math.min(low, terrain.heightAt(Math.floor(x) + dx, Math.floor(z) + dz));
        if (low > 7) spot = { x: Math.floor(x), z: Math.floor(z), low };
      }
    }
    if (spot === null) throw new Error('no high ground found');
    const floor = Math.floor((spot.low - 5) / VOXEL);
    for (let metre = 0; metre < 4; metre++) {
      for (const up of [0, 2]) {
        sim.dug.apply({
          ix: spot.x * 2 + metre * 2,
          iy: floor + up,
          iz: spot.z * 2,
          dir: CUBE_DIG,
        });
      }
    }
    sim.placePlayer(1, { x: spot.x + 2.5, y: floor * VOXEL, z: spot.z + 0.5 }, 0);
    sim.useItem(1, 'mineSupport');
    return { sim, cell: { ix: spot.x * 2 + 2, iy: floor, iz: spot.z * 2 } };
  }

  it('stands one, uses one up and tells everybody', () => {
    const { sim, cell } = inATunnel(2);
    expect(sim.placeSupport(1, cell)).toBe(true);
    expect(sim.supportsList()).toEqual([{ ...cell, axis: 0 }]);
    expect(sim.drainSupportNews()).toHaveLength(1);
    expect(sim.drainSupportNews()).toHaveLength(0);
    expect(countOf(sim.inventoryOf(1), 'mineSupport')).toBe(1);
  });

  it('will not stand a second in the same place', () => {
    const { sim, cell } = inATunnel(3);
    expect(sim.placeSupport(1, cell)).toBe(true);
    expect(sim.placeSupport(1, cell)).toBe(false);
    expect(sim.supportsList()).toHaveLength(1);
    expect(sim.drainDigRefusals().map((refusal) => refusal.reason)).toContain('supportTaken');
    expect(countOf(sim.inventoryOf(1), 'mineSupport')).toBe(2);
  });

  it('will not stand one in open ground, or from too far away', () => {
    const { sim, cell } = inATunnel(2);
    expect(sim.placeSupport(1, { ...cell, iz: cell.iz + 40 })).toBe(false);
    expect(sim.drainDigRefusals().map((refusal) => refusal.reason)).toContain('far');
    sim.placePlayer(
      1,
      { x: (cell.ix + 1) * VOXEL, y: cell.iy * VOXEL, z: (cell.iz + 30) * VOXEL },
      0,
    );
    expect(sim.placeSupport(1, { ...cell, iz: cell.iz + 30 })).toBe(false);
    expect(sim.drainDigRefusals().map((refusal) => refusal.reason)).toContain('notTunnel');
    expect(sim.supportsList()).toHaveLength(0);
  });

  it('needs a support in hand', () => {
    const { sim, cell } = inATunnel(1);
    removeItem(sim.inventoryOf(1), 'mineSupport');
    expect(sim.placeSupport(1, cell)).toBe(false);
  });

  it('keeps what it is told is saved', () => {
    const { sim } = inATunnel(1);
    sim.restoreSupports([
      { ix: 4, iy: 8, iz: 0, axis: 0 },
      { ix: 1.5, iy: 0, iz: 0, axis: 0 },
      { ix: 6, iy: 8, iz: 0, axis: 2 as 0 },
    ]);
    expect(sim.supportsList()).toEqual([{ ix: 4, iy: 8, iz: 0, axis: 0 }]);
  });
});
