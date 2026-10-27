import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  RUMORS,
  RUMOR_IDS,
  EXPEDITIONS,
  emptyExpedition,
  expeditionOffers,
  rumorOutcome,
  rumorRoute,
  rumorInteraction,
  expeditionFromSaved,
  expeditionComplete,
  progressExpedition,
  createInput,
  PlayerButton,
  encodeExpeditionState,
  decodeServerMessage,
  ITEM_KINDS,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((s) => s.dispose()));
function setup(active = 12) {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    raidIntervalSeconds: 86400,
    hungerEmptyAfterSeconds: Infinity,
  });
  worlds.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind: 'tent', x: 0, z: -5, yaw: 0, ownerKey: 'owner', lit: false, litUntilMs: null },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  const saved = sim.persistablePlayers()[0]!;
  sim.removePlayer(1);
  sim.addPlayer(1, { ...saved, expedition: { ...emptyExpedition(), active } }, 'owner');
  sim.addPlayer(2, undefined, 'friend');
  return sim;
}
let seq = 0;
function inspect(sim: WorldSimulation, index: number, height = 0) {
  const site = rumorRoute(sim.expeditionStateOf(1), sim.discoverySites)[index]!;
  sim.placePlayer(1, { ...site, y: sim.collision.terrain.heightAt(site.x, site.z) + height }, 0);
  sim.queueInput(1, createInput(++seq, 0, 0, 0, 0));
  sim.step(1000 + seq * 100);
  sim.queueInput(1, createInput(++seq, 0, 0, 0, PlayerButton.Interact));
  sim.step(1000 + seq * 100);
}
it('rotates all three rumors alongside ordinary outings while preserving the two story offers', () => {
  const first = emptyExpedition();
  const ids = RUMOR_IDS.map(
    (_, index) => expeditionOffers('tent', { ...first, cycle: index * 2 }, 42, 'owner')[0],
  );
  expect(new Set(ids)).toEqual(new Set(RUMOR_IDS));
  expect(expeditionOffers('tent', first, 42, 'owner')).toEqual(
    expeditionOffers('tent', first, 42, 'owner'),
  );
  expect(RUMOR_IDS).not.toContain(expeditionOffers('tent', { ...first, cycle: 1 }, 42, 'owner')[0]);
  expect(expeditionOffers('tent', first, 42, 'owner').slice(1)).toEqual([11, 8]);
  expect(EXPEDITIONS.slice(0, 12).map((r) => r.id)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});
it('selects varied outcomes deterministically and keeps the established packet shape', () => {
  for (const rumor of RUMORS) {
    const outcomes = new Set(
      Array.from(
        { length: 30 },
        (_, cycle) => rumorOutcome({ ...emptyExpedition(), active: rumor.id, cycle }, 42)!.title,
      ),
    );
    expect(outcomes.size).toBe(rumor.outcomes.length);
    const state = { ...emptyExpedition(), active: rumor.id, progress: [1, 1, 0] };
    expect(rumorOutcome(state, 42)).toEqual(rumorOutcome(expeditionFromSaved(state), 42));
    const view = { ...state, offers: [12, 11, 8], notice: 'accepted' as const };
    const packet = encodeExpeditionState(view);
    expect(packet.byteLength).toBe(21);
    expect(decodeServerMessage(packet)).toMatchObject({ ...view, type: 'expedition' });
  }
});
it('ignores out-of-order steps and insists on a shovel without consuming held food', () => {
  const sim = setup();
  Object.assign(sim.inventoryOf(1), { berry: 2 });
  sim.useItem(1, 'berry');
  inspect(sim, 2);
  expect(sim.expeditionStateOf(1).progress).toEqual([0, 0, 0]);
  inspect(sim, 0);
  inspect(sim, 1);
  inspect(sim, 2);
  expect(sim.expeditionStateOf(1).progress).toEqual([1, 1, 0]);
  expect(sim.inventoryOf(1).berry).toBe(2);
  expect(sim.expeditionStateOf(2).progress).toEqual([0, 0, 0]);
  const state = { ...emptyExpedition(), active: 12 };
  expect(progressExpedition(state, { kind: 'rumor', step: 2 })).toBe(false);
});
it('persists clues, refuses elevated interaction and pays the chosen find once at home', () => {
  const sim = setup();
  inspect(sim, 0);
  inspect(sim, 1);
  const saved = sim.persistablePlayers().find((p) => p.netId === 1)!;
  sim.removePlayer(1);
  sim.addPlayer(1, saved, 'owner');
  sim.giveTestGear(1, ['shovel']);
  sim.useItem(1, 'shovel');
  inspect(sim, 2, 5);
  expect(expeditionComplete(sim.expeditionStateOf(1))).toBe(false);
  inspect(sim, 2);
  const completed = sim.expeditionStateOf(1);
  expect(expeditionComplete(completed)).toBe(true);
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('away');
  const outcome = rumorOutcome(completed, sim.seed)!;
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, 7);
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('claimed');
  for (const reward of outcome.rewards)
    expect(sim.inventoryOf(1)[reward.item]).toBeGreaterThanOrEqual(reward.count);
  const bag = { ...sim.inventoryOf(1) };
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('unfinished');
  expect(sim.inventoryOf(1)).toEqual(bag);
});
it('does not interact without the matching active rumor or from beyond the landmark', () => {
  const sim = setup();
  const state = sim.expeditionStateOf(1),
    site = rumorRoute(state, sim.discoverySites)[0]!;
  expect(rumorInteraction(emptyExpedition(), sim.discoverySites, site, 'shovel')).toBeNull();
  expect(
    rumorInteraction(state, sim.discoverySites, { x: site.x + 20, z: site.z }, 'shovel'),
  ).toBeNull();
});

it('retains the sealed find and exact inventory when the complete reward cannot fit', () => {
  const sim = setup();
  const saved = sim.persistablePlayers().find((p) => p.netId === 1)!;
  const cycle = Array.from({ length: 30 }, (_, i) => i).find(
    (c) =>
      !rumorOutcome({ ...emptyExpedition(), active: 12, cycle: c }, sim.seed)!.rewards.some(
        (r) => r.item === 'bag',
      ),
  )!;
  sim.removePlayer(1);
  sim.addPlayer(
    1,
    { ...saved, expedition: { ...emptyExpedition(), active: 12, cycle, progress: [1, 1, 1] } },
    'owner',
  );
  Object.assign(sim.inventoryOf(1), {
    axe: 1,
    rod: 1,
    log: ITEM_KINDS.log.stackSize,
    stick: ITEM_KINDS.stick.stackSize,
    berry: 10,
    mushroom: 10,
    flower: 10,
    bone: 10,
  });
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, 7);
  const before = { ...sim.inventoryOf(1) },
    state = sim.expeditionStateOf(1);
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('full');
  expect(sim.inventoryOf(1)).toEqual(before);
  expect(sim.expeditionStateOf(1)).toEqual(state);
});
