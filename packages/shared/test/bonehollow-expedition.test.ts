import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  SKELETON_TOWN,
  BONEHOLLOW_EXPEDITION_ID,
  emptyExpedition,
  expeditionFromSaved,
  expeditionOffers,
  progressExpedition,
  expeditionComplete,
  captainAttackPlan,
  encodeRaiderVitals,
  decodeServerMessage,
  encodeRaiders,
  RAIDER_KIND_ORDER,
  ITEM_ORDER,
  createInput,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((s) => s.dispose()));
function setup() {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    forestEncounters: true,
    raidIntervalSeconds: 100000,
  });
  sims.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind: 'tent', x: 0, z: -5, yaw: 0, ownerKey: 'owner', lit: false, litUntilMs: null },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, 7);
  expect(sim.requestExpedition(1, { action: 'accept', index: 2 }).active).toBe(
    BONEHOLLOW_EXPEDITION_ID,
  );
  return sim;
}
it('always offers the adventure, preserves progress and keeps old wire IDs', () => {
  for (const home of ['tent', 'teepee', 'cabin', 'largeCabin'] as const)
    expect(expeditionOffers(home, emptyExpedition(), 42, 'owner')[2]).toBe(
      BONEHOLLOW_EXPEDITION_ID,
    );
  const state = { ...emptyExpedition(), active: BONEHOLLOW_EXPEDITION_ID };
  progressExpedition(state, { kind: 'defeat' }, 99);
  expect(state.progress).toEqual([0, 0, 0]);
  progressExpedition(state, { kind: 'bonehollow', step: 'arrival' });
  progressExpedition(state, { kind: 'bonehollow', step: 'watch' }, 100);
  expect(expeditionComplete(state)).toBe(false);
  expect(expeditionFromSaved(state)).toEqual(state);
  progressExpedition(state, { kind: 'bonehollow', step: 'captain' });
  expect(expeditionComplete(state)).toBe(true);
  expect(RAIDER_KIND_ORDER.slice(0, 5)).toEqual(['minion', 'rogue', 'warrior', 'mage', 'sentinel']);
  expect(ITEM_ORDER.slice(-2)).toEqual(['watchCaptainHelm', 'lastBellTrophy']);
  expect(
    decodeServerMessage(encodeRaiders([{ id: 18000, kind: 'captain', hitsLeft: 28 }])),
  ).not.toBeNull();
  for (const maxHits of [28, 36, 44, 52])
    expect(decodeServerMessage(encodeRaiderVitals(18000, maxHits))).toMatchObject({ maxHits });
  expect(decodeServerMessage(encodeRaiderVitals(18000, 53))).toBeNull();
});
it('gives the captain a readable third-attack whirlwind and a later combo phase', () => {
  expect([0, 1, 2, 3, 4, 5].map((turn) => captainAttackPlan(turn, 1).strike)).toEqual([
    false,
    false,
    true,
    false,
    false,
    true,
  ]);
  expect(captainAttackPlan(0, 1).swings).toBe(2);
  expect(captainAttackPlan(0, 0.5).swings).toBe(3);
});
it('counts only real town contributors and pays the helm once on claiming at home', () => {
  const sim = setup();
  sim.addPlayer(2, undefined, 'spectator');
  const at = {
    x: SKELETON_TOWN.x,
    y: sim.collision.terrain.heightAt(SKELETON_TOWN.x, SKELETON_TOWN.z),
    z: SKELETON_TOWN.z + 18,
  };
  sim.placePlayer(1, { ...at, z: at.z + 22 }, 0);
  sim.placePlayer(2, { ...at, x: at.x + 5, z: at.z + 22 }, 0);
  sim.queueInput(1, createInput(1, 0, 0, 0, 0));
  for (let i = 0; i < 40; i++) sim.step(1000 + i * 50);
  sim.placePlayer(1, at, 0);
  sim.queueInput(1, createInput(2, 0, 0, 0, 0));
  sim.step(3050);
  expect(sim.expeditionStateOf(1).progress).toEqual([1, 0, 0]);
  const residents = sim.raidersList();
  expect(residents).toHaveLength(13);
  const captain = residents.find((r) => r.kind === 'captain')!;
  for (const r of residents) sim.raids.placeRaider(r.id, { ...at, x: at.x + 45 }, 0);
  const victims = [...residents.filter((r) => r.kind !== 'captain').slice(0, 6), captain];
  for (const r of victims) {
    sim.raids.placeRaider(r.id, { ...at, z: at.z - 1.3 }, Math.PI);
    for (
      let strike = 0;
      strike < 15 && sim.raidersList().find((v) => v.id === r.id)!.hitsLeft > 0;
      strike++
    )
      sim.raids.blowLands(1, at, 0, { kind: 'strike' }, 0);
    expect(sim.raidersList().find((v) => v.id === r.id)!.hitsLeft).toBe(0);
  }
  expect(sim.expeditionStateOf(1).progress).toEqual([1, 6, 1]);
  expect(sim.expeditionStateOf(2).progress).toEqual([0, 0, 0]);
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('away');
  const saved = sim.persistablePlayers().find((p) => p.netId === 1)!;
  sim.removePlayer(1);
  sim.addPlayer(1, saved, 'owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, 7);
  sim.inventoryOf(1).log = 60;
  const fullPack = { ...sim.inventoryOf(1) };
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('full');
  expect(sim.inventoryOf(1)).toEqual(fullPack);
  expect(sim.expeditionStateOf(1).progress).toEqual([1, 6, 1]);
  delete sim.inventoryOf(1).log;
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('claimed');
  expect(sim.inventoryOf(1).watchCaptainHelm).toBe(1);
  expect(sim.inventoryOf(1).lastBellTrophy).toBe(1);
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('unfinished');
  expect(sim.inventoryOf(1).watchCaptainHelm).toBe(1);
  expect(sim.inventoryOf(1).lastBellTrophy).toBe(1);
});
