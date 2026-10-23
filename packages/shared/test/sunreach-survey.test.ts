import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  SUNREACH_EXPEDITION_ID,
  SUNREACH_SURVEY,
  SUNREACH_REMNANTS,
  SUNREACH_NOTES,
  emptyExpedition,
  expeditionFromSaved,
  expeditionOffers,
  expeditionComplete,
  surveyInteraction,
  createInput,
  PlayerButton,
  encodeExpeditionState,
  decodeServerMessage,
  ITEM_ORDER,
  BUILDABLE_KIND_ORDER,
  DECORATION_REQUEST_KINDS,
  buildableKindIndex,
  itemIndex,
  buildWilderness,
  createWildernessTerrain,
  colliderFootprintRadius,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function setup() {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    hungerEmptyAfterSeconds: Infinity,
    raidIntervalSeconds: 86400,
  });
  worlds.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind: 'tent', x: 0, z: -5, yaw: 0, ownerKey: 'ranger', lit: false, litUntilMs: null },
  ]);
  sim.addPlayer(1, undefined, 'ranger');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, 7);
  expect(sim.requestExpedition(1, { action: 'accept', index: 1 }).active).toBe(
    SUNREACH_EXPEDITION_ID,
  );
  sim.addPlayer(2, undefined, 'friend');
  return sim;
}
let seq = 0;
function inspect(sim: WorldSimulation, index: number, id = 1, depth = 0) {
  const site = SUNREACH_SURVEY[index]!;
  const y = sim.collision.terrain.heightAt(site.x, site.z);
  sim.placePlayer(id, { ...site, y: y + depth }, 0);
  sim.queueInput(id, createInput(++seq, 0, 0, 0, 0));
  sim.step(1000 + seq * 100);
  sim.queueInput(id, createInput(++seq, 0, 0, 0, PlayerButton.Interact));
  sim.step(1000 + seq * 100);
}
it('always offers Sunreach alongside Bonehollow without changing existing catalog prefixes', () => {
  expect(expeditionOffers('tent', emptyExpedition(), 42, 'ranger').slice(1)).toEqual([
    SUNREACH_EXPEDITION_ID,
    8,
  ]);
  expect(ITEM_ORDER.slice(50, 52)).toEqual(['watchCaptainHelm', 'lastBellTrophy']);
  expect(itemIndex('sunreachPennant')).toBe(57);
  expect(buildableKindIndex('sunreachPennant')).toBe(22);
  expect(BUILDABLE_KIND_ORDER.slice(20, 22)).toEqual(['rowboat', 'lastBellTrophy']);
  expect(DECORATION_REQUEST_KINDS.slice(12, 14)).toEqual(['lastBellTrophy', 'campfire']);
});
it('requires ordered deliberate interactions and an active shovel; never eats food at a clue', () => {
  const sim = setup();
  Object.assign(sim.inventoryOf(1), { berry: 2 });
  sim.useItem(1, 'berry');
  inspect(sim, 2);
  expect(sim.expeditionStateOf(1).progress).toEqual([0, 0, 0]);
  expect(sim.inventoryOf(1).berry).toBe(2);
  inspect(sim, 0);
  for (let tick = 0; tick < 5; tick++) {
    sim.queueInput(1, createInput(++seq, 0, 0, 0, PlayerButton.Interact));
    sim.step(1000 + seq * 100);
  }
  expect(sim.inventoryOf(1).berry).toBe(2);
  inspect(sim, 0);
  inspect(sim, 1);
  inspect(sim, 2);
  expect(sim.expeditionStateOf(1).progress).toEqual([1, 1, 0]);
  sim.giveTestGear(1, ['shovel']);
  sim.useItem(1, 'shovel');
  inspect(sim, 2);
  expect(expeditionComplete(sim.expeditionStateOf(1))).toBe(true);
  expect(sim.expeditionStateOf(2).progress).toEqual([0, 0, 0]);
  expect(sim.inventoryOf(1).sunreachPennant).toBeUndefined();
});
it('saves personal clue progress and claims rewards once at home, including already owned tools', () => {
  const sim = setup();
  inspect(sim, 0);
  inspect(sim, 1);
  const saved = sim.persistablePlayers().find((p) => p.netId === 1)!;
  expect(expeditionFromSaved(saved.expedition).progress).toEqual([1, 1, 0]);
  sim.removePlayer(1);
  sim.addPlayer(1, saved, 'ranger');
  sim.giveTestGear(1, ['shovel', 'refinedAxe']);
  sim.useItem(1, 'shovel');
  inspect(sim, 2);
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('away');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, 7);
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('claimed');
  expect(sim.inventoryOf(1)).toMatchObject({
    bag: 1,
    sunreachPennant: 1,
    leatherBoots: 1,
    refinedAxe: 1,
  });
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('unfinished');
  expect(sim.inventoryOf(1).sunreachPennant).toBe(1);
});
it('roundtrips the active adventure through the established packet and save format', () => {
  const state = { ...emptyExpedition(), active: SUNREACH_EXPEDITION_ID, progress: [1, 1, 0] };
  expect(
    decodeServerMessage(
      encodeExpeditionState({ ...state, offers: [0, SUNREACH_EXPEDITION_ID, 8], notice: 'none' }),
    ),
  ).toMatchObject(state);
  expect(surveyInteraction(state, SUNREACH_SURVEY[2], 'axe')).toMatchObject({ ready: false });
  expect(surveyInteraction(state, SUNREACH_SURVEY[2], 'shovel')).toMatchObject({ ready: true });
});
it('keeps generated trees and rocks clear of the entire survey trail across seeds', () => {
  for (const seed of [DEFAULT_WORLD_SEED, 42, 99]) {
    const terrain = createWildernessTerrain(seed);
    const wilderness = buildWilderness(seed, terrain);
    for (const site of SUNREACH_SURVEY)
      for (const collider of wilderness.colliders)
        expect(
          Math.hypot(collider.x - site.x, collider.z - site.z) - colliderFootprintRadius(collider),
        ).toBeGreaterThan(5.5);
  }
  expect(SUNREACH_REMNANTS).toHaveLength(2);
  expect(SUNREACH_NOTES[0]!.kind).toBe('camp');
});
