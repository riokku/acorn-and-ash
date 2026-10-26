import { afterEach, expect, it } from 'vitest';
import {
  CEDAR_STAG,
  ANIMAL_DENS,
  ANIMAL_KINDS,
  DEFAULT_WORLD_SEED,
  WorldSimulation,
  AnimalTrailHistory,
  TRACKED_ANIMALS,
  encodeAnimalTracks,
  decodeServerMessage,
  itemIndex,
  itemFromIndex,
  equipmentPreyNotice,
  characterStats,
  craft,
  createInventory,
  withEquipmentSpecialty,
  buildWoodlandTracks,
  PlayerButton,
  createInput,
} from '../src/index';
import { stepWildlifeAwareness } from '../src/sim/wildlife-awareness';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function setup() {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, raidIntervalSeconds: 86400 });
  worlds.push(sim);
  sim.addPlayer(1, undefined, 'hunter');
  sim.addPlayer(2, undefined, 'observer');
  return sim;
}
it('preserves old item/track IDs and appends the named quarry with a deterministic lead', () => {
  expect(itemIndex('axe')).toBe(0);
  expect(itemFromIndex(itemIndex('kingsRequiem'))).toBe('kingsRequiem');
  expect(itemIndex('cedarHide')).toBe(itemIndex('kingsRequiem') + 1);
  expect(TRACKED_ANIMALS.slice(0, 4)).toEqual(['rabbit', 'fox', 'elk', 'jackrabbit']);
  expect(TRACKED_ANIMALS[4]).toBe('cedarStag');
  expect(ANIMAL_DENS.find((den) => den.id === 1110)).toMatchObject(CEDAR_STAG);
  const lead = buildWoodlandTracks(DEFAULT_WORLD_SEED).filter((t) => t.kind === 'cedarStag');
  expect(lead.length).toBeGreaterThan(20);
  expect(Math.hypot(lead.at(-1)!.x - CEDAR_STAG.x, lead.at(-1)!.z - CEDAR_STAG.z)).toBeLessThan(2);
  const history = new AnimalTrailHistory();
  history.observe(1110, 'cedarStag', 0, 0, true);
  history.observe(1110, 'cedarStag', 2, 0, true);
  const decoded = decodeServerMessage(encodeAnimalTracks(history.near(0, 0)));
  expect(decoded).toMatchObject({ type: 'animalTracks', tracks: [{ kind: 'cedarStag' }] });
});
it('reacts sooner than common elk, lets pauses calm attention and never grants immunity', () => {
  const kind = ANIMAL_KINDS.cedarStag;
  expect(kind.fleeSpeed).toBeGreaterThan(ANIMAL_KINDS.elk.fleeSpeed);
  const alarm = stepWildlifeAwareness(0, false, 5, 4.5, kind, 0.5);
  expect(alarm.awareness).toBeGreaterThan(
    stepWildlifeAwareness(0, false, 5, 4.5, { ...kind, awarenessTimeScale: 1 }, 0.5).awareness,
  );
  expect(stepWildlifeAwareness(alarm.awareness, false, 5, 0, kind, 1).awareness).toBeLessThan(
    alarm.awareness,
  );
  expect(
    stepWildlifeAwareness(0, false, 1, 0, { ...kind, alertRadius: kind.alertRadius * 0.85 }, 0.05)
      .fleeing,
  ).toBe(true);
  expect(equipmentPreyNotice({ upperBody: 'cedarstalkerCoat' })).toBe(0.85);
  expect(equipmentPreyNotice({ helm: 'cedarstalkerCoat' })).toBe(1);
  expect(withEquipmentSpecialty('cedarstalkerCoat', 'My coat.')).toContain('15%');
});
it('stitches atomically with the exact material cost and retains normal slot/stat rules', () => {
  const pack = createInventory();
  Object.assign(pack, { cedarHide: 1, rope: 2, reed: 3 });
  expect(craft(pack, 'cedarstalkerCoat')).toBe(false);
  expect(pack.cedarHide).toBe(1);
  pack.reed = 4;
  expect(craft(pack, 'cedarstalkerCoat')).toBe(true);
  expect(pack.cedarstalkerCoat).toBe(1);
  expect(pack.cedarHide ?? 0).toBe(0);
  expect(craft(pack, 'cedarstalkerCoat')).toBe(false);
  expect(characterStats({ upperBody: 'cedarstalkerCoat' })).toMatchObject({
    protection: 6,
    warmth: 45,
  });
});
it('pays one hide only once per real catch, then crafts and equips the earned coat', () => {
  const sim = setup(),
    at = {
      x: CEDAR_STAG.x,
      z: CEDAR_STAG.z,
      y: sim.collision.terrain.heightAt(CEDAR_STAG.x, CEDAR_STAG.z),
    };
  sim.placeAnimal(CEDAR_STAG.id, at);
  sim.placePlayer(1, { ...at, z: at.z + 2.05 }, 0);
  sim.inventoryOf(1).axe = 1;
  sim.useItem(1, 'axe');
  for (let i = 0; i < 20; i++) {
    sim.queueInput(1, createInput(i + 1, 0, 0, 0, i === 0 ? PlayerButton.Swing : 0));
    sim.step(1000 + i * 50);
  }
  expect(sim.inventoryOf(1).cedarHide).toBe(1);
  expect(sim.drainCatchEvents().filter((event) => event.item === 'cedarHide')).toHaveLength(1);
  Object.assign(sim.inventoryOf(1), { rope: 2, reed: 4 });
  expect(sim.craftItem(1, 'cedarstalkerCoat')).toBe(true);
  expect(sim.wearGear(1, 'cedarstalkerCoat', 'upperBody').ok).toBe(true);
  expect(sim.persistablePlayers().find((p) => p.netId === 1)?.worn).toContainEqual({
    slot: 'upperBody',
    item: 'cedarstalkerCoat',
  });
}, 15000);
it('leaves an owner-bound hide when full, and keeps it through a world save', () => {
  const sim = setup();
  sim.inventoryOf(1).log = 10000;
  const internal = sim as unknown as {
    players: Map<number, unknown>;
    catchAnimal(runtime: unknown, id: number, charged: boolean): void;
  };
  internal.catchAnimal(internal.players.get(1), CEDAR_STAG.id, true);
  internal.catchAnimal(internal.players.get(1), CEDAR_STAG.id, true);
  expect(sim.inventoryOf(1).cedarHide ?? 0).toBe(0);
  const pile = sim.droppedPilesList(1).find((p) => p.item === 'cedarHide');
  expect(pile?.count).toBe(1);
  expect(sim.droppedPilesList(2).some((p) => p.item === 'cedarHide')).toBe(false);
  const saved = sim.persistedPile(pile!.id)!;
  expect(saved.ownerKey).toBe('hunter');
  const restored = setup();
  restored.restoreDroppedPiles([saved], 1000);
  expect(restored.droppedPilesList(1).filter((p) => p.item === 'cedarHide')).toHaveLength(1);
  expect(restored.droppedPilesList(2).some((p) => p.item === 'cedarHide')).toBe(false);
}, 15000);

it('uses the worn coat in actual server prey detection, without hiding an unprotected observer', () => {
  for (const dressed of [false, true]) {
    const sim = setup(),
      at = {
        x: CEDAR_STAG.x,
        z: CEDAR_STAG.z,
        y: sim.collision.terrain.heightAt(CEDAR_STAG.x, CEDAR_STAG.z),
      };
    if (dressed) {
      sim.giveTestGear(1, ['cedarstalkerCoat']);
      sim.wearGear(1, 'cedarstalkerCoat', 'upperBody');
    }
    sim.placeAnimal(CEDAR_STAG.id, at);
    sim.placePlayer(1, { ...at, z: at.z + 3.9 }, 0);
    for (let i = 0; i < 20; i++) sim.step(1000 + i * 50);
    const animal = sim.snapshotFor(1).find((e) => e.netId === CEDAR_STAG.id)!;
    expect(Math.hypot(animal.vx, animal.vz) > 0.1).toBe(!dressed);
    if (dressed) {
      sim.placePlayer(2, { ...at, x: at.x + 3.9 }, 0);
      for (let i = 20; i < 40; i++) sim.step(1000 + i * 50);
      const alarmed = sim.snapshotFor(1).find((e) => e.netId === CEDAR_STAG.id)!;
      expect(Math.hypot(alarmed.vx, alarmed.vz)).toBeGreaterThan(0.1);
    }
  }
}, 15000);
