import { afterEach, describe, expect, it } from 'vitest';
import {
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  EXPEDITIONS,
  emptyExpedition,
  expeditionFromSaved,
  expeditionOffers,
  expeditionComplete,
  progressExpedition,
  expeditionBoardSpot,
  encodeExpeditionRequest,
  encodeExpeditionState,
  decodeClientMessage,
  decodeServerMessage,
  ITEM_KINDS,
  type ExpeditionState,
  type ItemId,
  createInput,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((sim) => sim.dispose()));
function atBoard(saved: ExpeditionState = emptyExpedition()) {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind: 'tent', x: 0, z: -5, yaw: 0, ownerKey: 'owner', lit: false, litUntilMs: null },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  const player = sim.persistablePlayers()[0]!;
  sim.removePlayer(1);
  sim.addPlayer(1, { ...player, expedition: saved }, 'owner');
  sim.addPlayer(2, undefined, 'visitor');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, 7);
  sim.placePlayer(2, { x: 0, y: 0, z: 0 }, 0, 7);
  return sim;
}
function complete(active = 0, completed = 0): ExpeditionState {
  return {
    ...emptyExpedition(),
    active,
    completed,
    cycle: completed,
    progress: EXPEDITIONS[active]!.objectives.map((g) => g.goal),
  };
}
describe('optional personal expeditions', () => {
  it('offers three stable distinct eligible choices and refreshes after completion', () => {
    const state = emptyExpedition(),
      first = expeditionOffers('tent', state, 42, 'owner');
    expect(new Set(first).size).toBe(3);
    expect(first.every((id) => EXPEDITIONS[id]!.tier === 0)).toBe(true);
    expect(expeditionOffers('tent', state, 42, 'owner')).toEqual(first);
    expect(expeditionOffers('tent', { ...state, cycle: 1 }, 42, 'owner')).not.toEqual(first);
    expect(
      expeditionOffers('cabin', state, 42, 'owner').every((id) => EXPEDITIONS[id]!.tier <= 2),
    ).toBe(true);
  });
  it('matches real objective types, caps progress, ignores irrelevant or invalid events', () => {
    const state = { ...emptyExpedition(), active: 0 };
    expect(progressExpedition(state, { kind: 'gather', item: 'berry' }, 100)).toBe(false);
    expect(progressExpedition(state, { kind: 'chop' }, -1)).toBe(false);
    expect(progressExpedition(state, { kind: 'chop' }, NaN)).toBe(false);
    progressExpedition(state, { kind: 'chop' }, 100);
    progressExpedition(state, { kind: 'gather', item: 'stick' }, 12);
    expect(expeditionComplete(state)).toBe(false);
    progressExpedition(state, { kind: 'visit', site: 'logging' });
    expect(state.progress).toEqual([4, 12, 1]);
    expect(expeditionComplete(state)).toBe(true);
    expect(progressExpedition(state, { kind: 'chop' })).toBe(false);
  });
  it('normalizes legacy or malformed saves without granting recipes', () => {
    for (const bad of [
      null,
      {},
      { ...complete(), active: 99 },
      { ...complete(), cosmetics: 128 },
      { ...complete(), progress: [1, -2, 0] },
    ])
      expect(expeditionFromSaved(bad)).toEqual(emptyExpedition());
    expect(expeditionFromSaved({ ...complete(), progress: [500, 500, 500] }).progress).toEqual([
      4, 12, 1,
    ]);
    expect(expeditionFromSaved({ ...emptyExpedition(), progress: [5, 5, 5] }).progress).toEqual([
      0, 0, 0,
    ]);
  });
  it('allows accepting only one outing at the own board and refuses forged indexes', () => {
    const sim = atBoard();
    expect(sim.requestExpedition(2, { action: 'accept', index: 0 }).notice).toBe('away');
    expect(sim.requestExpedition(1, { action: 'accept', index: 99 }).notice).toBe('choice');
    expect(sim.requestExpedition(1, { action: 'accept', index: 0 }).notice).toBe('accepted');
    expect(sim.drainExpeditionChanges()).toEqual([]);
    expect(sim.requestExpedition(1, { action: 'accept', index: 1 }).notice).toBe('active');
    expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('unfinished');
    sim.placePlayer(1, { x: 30, y: 0, z: 30 }, 0);
    expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('away');
    const spot = expeditionBoardSpot({ kind: 'tent', x: 0, z: -5, yaw: 0 });
    sim.placePlayer(1, { ...spot, y: 0 }, 0);
    expect(sim.nearExpeditionBoardOf(1)).toBe(true);
  });
  it('keeps all rewards and progress intact with a full pack, then pays once atomically', () => {
    const sim = atBoard(complete());
    const inv = sim.inventoryOf(1);
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
    const before = { ...inv };
    expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('full');
    expect(inv).toEqual(before);
    expect(sim.expeditionStateOf(1).active).toBe(0);
    for (const item of Object.keys(inv)) delete inv[item as ItemId];
    const claimed = sim.requestExpedition(1, { action: 'claim' });
    expect(claimed).toMatchObject({ active: null, completed: 1, cycle: 1, progress: [0, 0, 0] });
    expect(inv).toEqual({ log: 6, stick: 4 });
    expect(sim.drainExpeditionChanges()).toEqual([]);
    expect(sim.requestExpedition(1, { action: 'claim' }).notice).toBe('unfinished');
    expect(inv).toEqual({ log: 6, stick: 4 });
  });
  it('unlocks the real cosmetic on the third claim and preserves private progress across saves', () => {
    const sim = atBoard(complete(0, 2));
    expect(sim.requestExpedition(1, { action: 'claim' }).cosmetics).toBe(1);
    const saved = sim.persistablePlayers().find((p) => p.netId === 1)!;
    sim.removePlayer(1);
    sim.addPlayer(1, saved, 'owner');
    expect(sim.expeditionStateOf(1)).toMatchObject({ completed: 3, cosmetics: 1 });
    expect(sim.expeditionStateOf(2).completed).toBe(0);
  });
  it('counts a genuine revisit of an already discovered landmark and never invents gathering from inventory changes', () => {
    const sim = atBoard({ ...emptyExpedition(), active: 0 });
    const site = sim.discoverySites.find((s) => s.kind === 'logging')!;
    Object.assign(sim.inventoryOf(1), { stick: 12, log: 4 });
    expect(sim.expeditionStateOf(1).progress).toEqual([0, 0, 0]);
    sim.placePlayer(
      1,
      { x: site.x, y: sim.collision.terrain.heightAt(site.x, site.z), z: site.z },
      0,
    );
    sim.queueInput(1, createInput(1, 0, 0, 0, 0));
    sim.step(1000);
    expect(sim.expeditionStateOf(1).progress).toEqual([0, 0, 1]);
    expect(sim.expeditionStateOf(2).progress).toEqual([0, 0, 0]);
  });
  it('refuses locked cosmetic placement without spending materials', () => {
    const sim = atBoard();
    Object.assign(sim.inventoryOf(1), { stick: 2, flower: 2 });
    expect(
      sim.requestDecoration(1, {
        action: 'place',
        kind: 'trailPennant',
        id: 0,
        x: -0.6,
        z: -0.5,
        yaw: 0,
      }).reason,
    ).toBe('recipe');
    expect(sim.inventoryOf(1)).toEqual({ stick: 2, flower: 2 });
  });
});
describe('expedition packets', () => {
  it('roundtrips requests and private progress without truncating counters', () => {
    expect(decodeClientMessage(encodeExpeditionRequest({ action: 'accept', index: 2 }))).toEqual({
      type: 'expedition',
      action: 'accept',
      index: 2,
    });
    expect(decodeClientMessage(encodeExpeditionRequest({ action: 'claim' }))).toEqual({
      type: 'expedition',
      action: 'claim',
    });
    const view = {
      ...complete(0, 70000),
      offers: [0, 1, 2],
      notice: 'full' as const,
      cosmetics: 1,
    };
    expect(decodeServerMessage(encodeExpeditionState(view))).toEqual({
      type: 'expedition',
      ...view,
    });
  });
  it('rejects invalid lengths, choice ids and duplicate offers', () => {
    const req = new Uint8Array(encodeExpeditionRequest({ action: 'accept', index: 0 }));
    req[2] = 3;
    expect(decodeClientMessage(req.buffer)).toBeNull();
    expect(decodeClientMessage(req.buffer.slice(0, 2))).toBeNull();
    const packet = new Uint8Array(
      encodeExpeditionState({ ...emptyExpedition(), offers: [0, 1, 2], notice: 'none' }),
    );
    expect(decodeServerMessage(packet.buffer.slice(0, 20))).toBeNull();
    packet[18] = 0;
    expect(decodeServerMessage(packet.buffer)).toBeNull();
  });
});
