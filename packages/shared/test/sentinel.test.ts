import { afterEach, describe, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  sentinelToughness,
  RAIDER_KIND_ORDER,
  ITEM_ORDER,
  encodeRaiderVitals,
  decodeServerMessage,
  type WorldSimulation as Simulation,
  MAX_DROPPED_PILES,
} from '../src/index';
const sims: Simulation[] = [];
afterEach(() => sims.splice(0).forEach((s) => s.dispose()));
function setup() {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, raidIntervalSeconds: 100000 });
  sims.push(sim);
  for (let id = 1; id <= 3; id++) {
    sim.addPlayer(id, undefined, `fighter-${id}`);
    const saved = sim.persistablePlayers().find((p) => p.netId === id)!;
    sim.removePlayer(id);
    sim.addPlayer(id, { ...saved, blueprintMisses: 5 }, `fighter-${id}`);
    sim.placePlayer(id, { x: 0, y: 0, z: 0 }, 0);
  }
  return sim;
}
function boss(sim: Simulation) {
  const raid = sim.startRaid(1, ['sentinel'])!;
  const id = sim.raids.raidersOf(raid)[0]!;
  sim.raids.placeRaider(id, { x: 0, y: 0, z: -1.3 }, Math.PI);
  return id;
}
function hit(sim: Simulation, id: number, attacker = 1) {
  sim.raids.placeRaider(id, { x: 0, y: 0, z: -1.3 }, Math.PI);
  sim.raids.blowLands(attacker, { x: 0, y: 0, z: 0 }, 0, { kind: 'strike' }, 0);
}
function beat(sim: Simulation, id: number, helper = false) {
  if (helper) hit(sim, id, 2);
  for (let i = 0; i < 14 && sim.raids.raidersList().find((r) => r.id === id)?.hitsLeft !== 0; i++)
    hit(sim, id);
  expect(sim.raids.raidersList().find((r) => r.id === id)?.hitsLeft).toBe(0);
}
describe('ruin sentinel', () => {
  it('keeps existing kind and item indexes and has bounded solo/cooperative toughness', () => {
    expect(RAIDER_KIND_ORDER.slice(0, 4)).toEqual(['minion', 'rogue', 'warrior', 'mage']);
    expect(ITEM_ORDER.slice(0, 3)).toEqual(['axe', 'log', 'rod']);
    expect([1, 2, 3, 4, 50].map(sentinelToughness)).toEqual([24, 32, 40, 48, 48]);
  });
  it('adds health for genuine helpers once, with no scaling from a spectator or repeated hits', () => {
    const sim = setup(),
      id = boss(sim);
    expect(sim.raids.maxHitsOf(id)).toBe(24);
    hit(sim, id);
    expect(sim.raids.maxHitsOf(id)).toBe(24);
    hit(sim, id, 2);
    expect(sim.raids.maxHitsOf(id)).toBe(32);
    hit(sim, id, 2);
    expect(sim.raids.maxHitsOf(id)).toBe(32);
    expect(sim.sentinelVictoriesOf(3)).toBe(0);
  });
  it('does not count the same character twice after a reconnect', () => {
    const sim = setup(),
      id = boss(sim);
    sim.step(1000);
    hit(sim, id);
    const saved = sim.persistablePlayers().find((p) => p.netId === 1)!;
    sim.removePlayer(1);
    sim.addPlayer(4, saved, 'fighter-1');
    sim.placePlayer(4, { x: 0, y: 0, z: 0 }, 0);
    sim.step(1050);
    hit(sim, id, 4);
    expect(sim.raids.maxHitsOf(id)).toBe(24);
  });
  it('awards protected first trophies and blueprint rolls to nearby contributors but no spectator', () => {
    const sim = setup(),
      id = boss(sim);
    beat(sim, id, true);
    for (const player of [1, 2]) {
      const items = sim.droppedPilesList(player);
      expect(items.filter((p) => p.item === 'sentinelTrophy')).toHaveLength(1);
      expect(items.filter((p) => p.item === 'teepeeBlueprint')).toHaveLength(1);
      expect(items.some((p) => p.item === 'bone' && p.count === 4)).toBe(true);
      expect(sim.sentinelVictoriesOf(player)).toBe(1);
    }
    expect(sim.droppedPilesList(3)).toEqual([]);
    expect(sim.sentinelVictoriesOf(3)).toBe(0);
  });
  it('saves the first-victory flag and pays useful repeat materials without a second trophy', () => {
    const sim = setup();
    beat(sim, boss(sim));
    const saved = sim.persistablePlayers().find((p) => p.netId === 1)!;
    sim.removePlayer(1);
    sim.addPlayer(1, saved, 'fighter-1');
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
    beat(sim, boss(sim));
    expect(sim.sentinelVictoriesOf(1)).toBe(2);
    expect(sim.droppedPilesList(1).filter((p) => p.item === 'sentinelTrophy')).toHaveLength(1);
    expect(sim.droppedPilesList(1).filter((p) => p.item === 'log')).toHaveLength(2);
  });
  it('preserves a full-pack keepsake through long absences and excludes distant contributors', () => {
    const sim = setup(),
      id = boss(sim);
    hit(sim, id, 2);
    sim.placePlayer(2, { x: 100, y: 0, z: 100 }, 0);
    sim.step(1000);
    beat(sim, id);
    expect(sim.sentinelVictoriesOf(2)).toBe(0);
    sim.fadeDroppedPiles(1e12);
    expect(sim.droppedPilesList(1).filter((p) => p.item === 'sentinelTrophy')).toHaveLength(1);
  });
  it('retains protected keepsakes through capacity pressure and restoring a long-lived world', () => {
    const sim = setup(),
      rows = Array.from({ length: MAX_DROPPED_PILES + 6 }, (_, i) => ({
        id: i + 1,
        item: 'sentinelTrophy' as const,
        count: 1,
        x: i,
        z: 0,
        droppedAtMs: 0,
        ownerKey: `owner-${i}`,
      }));
    sim.restoreDroppedPiles(
      [...rows, { id: 500, item: 'log', count: 2, x: 0, z: 2, droppedAtMs: 1 }],
      1000,
    );
    expect(rows.every((row) => sim.persistedPile(row.id)?.item === 'sentinelTrophy')).toBe(true);
    sim.inventoryOf(1).log = 1;
    sim.discardItem(1, { item: 'log', amount: 1, destroy: false }, 1000);
    sim.fadeDroppedPiles(1e12);
    expect(rows.every((row) => sim.persistedPile(row.id)?.item === 'sentinelTrophy')).toBe(true);
  });
  it('roundtrips boss health without changing ordinary raider packets and rejects forged maxima', () => {
    expect(decodeServerMessage(encodeRaiderVitals(18000, 32))).toEqual({
      type: 'raiderVitals',
      id: 18000,
      maxHits: 32,
    });
    expect(decodeServerMessage(encodeRaiderVitals(18000, 33))).toBeNull();
    expect(decodeServerMessage(encodeRaiderVitals(18000, 24).slice(0, 3))).toBeNull();
  });
});
