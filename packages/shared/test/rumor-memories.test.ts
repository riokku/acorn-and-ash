import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  emptyExpedition,
  RUMOR_IDS,
  rumorMemoryBit,
  rememberedRumors,
  TRAIL_PENNANT_SKILL,
  expeditionFromSaved,
  encodeExpeditionState,
  decodeServerMessage,
  ITEM_KINDS,
  rumorOutcome,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((s) => s.dispose()));
function home(active: number, cosmetics = 0, cycle = 0) {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  worlds.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind: 'tent', x: 0, z: -5, yaw: 0, ownerKey: 'owner', lit: false, litUntilMs: null },
  ]);
  sim.addPlayer(
    1,
    {
      netId: 1,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      hunger: 100,
      items: [],
      expedition: { ...emptyExpedition(), active, progress: [1, 1, 1], cosmetics, cycle },
    },
    'owner',
  );
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, 7);
  return sim;
}
it.each(RUMOR_IDS)(
  'remembers rumor %i and unlocks the existing pennant only after a successful home claim',
  (id) => {
    const sim = home(id);
    expect(sim.expeditionStateOf(1).cosmetics).toBe(0);
    const claimed = sim.requestExpedition(1, { action: 'claim' });
    expect(claimed.notice).toBe('claimed');
    expect(claimed.cosmetics).toBe(rumorMemoryBit(id) | TRAIL_PENNANT_SKILL);
    expect(rememberedRumors(claimed.cosmetics).map((r) => r.id)).toEqual([id]);
    expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('unfinished');
    const saved = sim.persistablePlayers()[0]!;
    sim.removePlayer(1);
    sim.addPlayer(1, saved, 'owner');
    expect(sim.expeditionStateOf(1).cosmetics).toBe(claimed.cosmetics);
    const packet = encodeExpeditionState(claimed);
    expect(packet.byteLength).toBe(21);
    expect(decodeServerMessage(packet)).toMatchObject({ cosmetics: claimed.cosmetics });
  },
);
it('preserves old pennants, remembers each story once and rejects unknown saved marks', () => {
  expect(expeditionFromSaved({ ...emptyExpedition(), cosmetics: 1 }).cosmetics).toBe(1);
  const all = RUMOR_IDS.reduce((mask, id) => mask | rumorMemoryBit(id), 1);
  expect(rememberedRumors(all)).toHaveLength(RUMOR_IDS.length);
  expect(rememberedRumors(all | rumorMemoryBit(12))).toEqual(rememberedRumors(all));
  expect(expeditionFromSaved({ ...emptyExpedition(), cosmetics: 128 })).toEqual(emptyExpedition());
  const sim = home(12, all);
  expect(sim.requestExpedition(1, { action: 'claim' }).cosmetics).toBe(all);
});
it('does not mark an unclaimed full-pack bundle as brought home', () => {
  const cycle = Array.from({ length: 30 }, (_, i) => i).find(
    (c) =>
      !rumorOutcome(
        { ...emptyExpedition(), active: 12, cycle: c },
        DEFAULT_WORLD_SEED,
      )!.rewards.some((r) => r.item === 'bag'),
  )!;
  const sim = home(12, 0, cycle),
    inv = sim.inventoryOf(1);
  // Choose a clothing find, so a full ordinary pack must refuse it atomically.
  Object.assign(inv, {
    axe: 1,
    rod: 1,
    log: ITEM_KINDS.log.stackSize,
    stick: ITEM_KINDS.stick.stackSize,
    berry: 10,
    mushroom: 10,
    flower: 10,
    bone: 10,
  });
  expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('full');
  expect(sim.expeditionStateOf(1).cosmetics).toBe(0);
});
