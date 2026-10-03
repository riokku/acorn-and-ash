import { afterEach, describe, expect, it } from 'vitest';
import {
  HOME_TIERS,
  HOME_SKILL_MASK,
  blueprintHome,
  blueprintForHome,
  nextHome,
  nextBlueprint,
  knowsHome,
  learnHome,
  HOME_WAKE_SPOT,
  homeSpot,
  homeRoomScale,
  homeRoomColliders,
  HOME_ENTRY,
  isLeavingRoom,
  cabinDoorway,
  cabinCollider,
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  createInput,
  encodeHomeSkills,
  encodeHomeBuildFeedback,
  decodeServerMessage,
  buildableKindIndex,
  itemIndex,
  type HomeKind,
  type BuiltProp,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose();
});
function world(kind?: HomeKind, skills = 7): WorldSimulation {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  if (kind !== undefined)
    sim.restoreBuiltProps([
      {
        id: 7,
        kind,
        x: 0,
        z: -4.2,
        yaw: 0,
        lit: false,
        locked: true,
        ownerKey: 'owner',
        litUntilMs: null,
      },
    ]);
  sim.addPlayer(
    1,
    { netId: 1, x: 0, y: 0, z: 0, facingYaw: 0, items: [], hunger: 100, homeSkills: skills },
    'owner',
  );
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  Object.assign(sim.inventoryOf(1), { log: 120, stick: 24, bone: 20 });
  return sim;
}
function build(sim: WorldSimulation, kind: HomeKind): void {
  sim.requestBuild(1, { kind, x: 0, z: -4.2, yaw: 0 });
  sim.queueInput(1, createInput(1, 0, 0, 0));
  sim.step(Date.now());
}
describe('housing knowledge and safe upgrades', () => {
  it('starts with the tent and discovers each next unlearned blueprint', () => {
    expect(nextHome(null)).toBe('tent');
    expect(knowsHome(0, 'tent')).toBe(true);
    let skills = 0;
    for (const kind of HOME_TIERS.slice(1)) {
      expect(blueprintHome(nextBlueprint(skills)!)).toBe(kind);
      skills = learnHome(skills, kind);
    }
    expect(skills).toBe(HOME_SKILL_MASK);
    expect(nextBlueprint(skills)).toBeNull();
  });
  it('grandfathers existing cabins so the next blueprint is the larger cabin', () => {
    const sim = world('cabin', 0);
    expect(sim.homeSkillsOf(1)).toBe(3);
    expect(nextBlueprint(sim.homeSkillsOf(1))).toBe('largeCabinBlueprint');
  });
  it('requires an actual blueprint item and consumes it only once', () => {
    const sim = world(undefined, 0);
    expect(sim.useItem(1, 'teepeeBlueprint')).toBe(false);
    sim.inventoryOf(1).teepeeBlueprint = 2;
    expect(sim.useItem(1, 'teepeeBlueprint')).toBe(true);
    expect(sim.homeSkillsOf(1)).toBe(1);
    expect(sim.inventoryOf(1).teepeeBlueprint).toBe(1);
    expect(sim.useItem(1, 'teepeeBlueprint')).toBe(false);
    expect(sim.inventoryOf(1).teepeeBlueprint).toBe(1);
    const saved = sim.persistablePlayers()[0]!;
    const back = world(undefined, 0);
    back.addPlayer(2, saved, 'returning');
    expect(back.homeSkillsOf(2)).toBe(1);
  });
  it('builds only a tent as the first home even when all blueprints are learned', () => {
    const sim = world();
    build(sim, 'cabin');
    expect(sim.builtPropsList()).toHaveLength(0);
    expect(sim.drainHomeBuildFeedback()[0]?.reason).toBe('tier');
    build(sim, 'tent');
    expect(sim.builtPropsList()[0]?.kind).toBe('tent');
  });
  for (const [from, to] of [
    ['tent', 'teepee'],
    ['teepee', 'cabin'],
    ['cabin', 'largeCabin'],
  ] as const) {
    it(`upgrades ${from} to ${to} without losing its identity, lock or chest`, () => {
      const sim = world(from);
      const before = sim.collision.colliders.length;
      sim.restoreChest(7, [{ item: 'bone', count: 3 }, ...Array(9).fill(null)]);
      build(sim, to);
      expect(sim.builtPropsList()[0]).toMatchObject({ id: 7, kind: to, locked: true });
      expect(sim.builtPropOwner(7)).toBe('owner');
      expect(sim.collision.colliders).toHaveLength(before);
      const at = homeSpot(HOME_WAKE_SPOT, to);
      sim.placePlayer(1, { ...at, y: 0 }, at.yaw, 7);
      expect(sim.requestChest(1, { action: 'open' }).slots[0]).toEqual({ item: 'bone', count: 3 });
      expect(sim.drainHomeBuildFeedback()[0]?.reason).toBeNull();
    });
  }
  it('refuses an unlearned upgrade without spending materials', () => {
    const sim = world('tent', 0);
    const before = { ...sim.inventoryOf(1) };
    build(sim, 'teepee');
    expect(sim.inventoryOf(1)).toEqual(before);
    expect(sim.builtPropsList()[0]?.kind).toBe('tent');
    expect(sim.drainHomeBuildFeedback()[0]?.reason).toBe('blueprint');
  });
  it('refuses a skipped tier and an occupied room', () => {
    const sim = world('tent');
    build(sim, 'cabin');
    expect(sim.drainHomeBuildFeedback()[0]?.reason).toBe('tier');
    sim.addPlayer(2, undefined, 'visitor');
    sim.placePlayer(2, { x: 0, y: 0, z: 0 }, 0, 7);
    build(sim, 'teepee');
    expect(sim.drainHomeBuildFeedback()[0]?.reason).toBe('occupied');
    expect(sim.builtPropsList()[0]?.kind).toBe('tent');
  });
  it('refuses enlargement into another building', () => {
    const sim = world('tent');
    sim.restoreBuiltProps([
      {
        id: 8,
        kind: 'campfire',
        x: 3.1,
        z: -4.2,
        yaw: 0,
        lit: false,
        ownerKey: null,
        litUntilMs: null,
      },
    ]);
    const before = { ...sim.inventoryOf(1) };
    build(sim, 'teepee');
    expect(sim.inventoryOf(1)).toEqual(before);
    expect(sim.drainHomeBuildFeedback()[0]?.reason).toBe('blocked');
  });
  it('occasionally drops the next unlearned blueprint when a skeleton is defeated, alongside its normal bones', () => {
    const sim = world(undefined, 1);
    let clock = Date.now(),
      sequence = 0,
      won = 0;
    for (let encounter = 0; encounter < 30; encounter++) {
      sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
      const raid = sim.startRaid(1, ['minion']);
      if (raid === null) continue;
      const id = sim.raids.raidersOf(raid)[0]!;
      sim.raids.placeRaider(id, { x: 0, y: 0, z: -1.4 }, Math.PI);
      sim.queueInput(1, createInput(++sequence, 0, 0, 0));
      sim.step((clock += 50));
      expect(sim.raids.blowLands(1, { x: 0, y: 0, z: 0 }, 0, { kind: 'strike' }, 0)).toBe(true);
      won++;
      for (let tick = 0; tick < 36; tick++) {
        sim.queueInput(1, createInput(++sequence, 0, 0, 0));
        sim.step((clock += 50));
      }
    }
    const piles = sim.droppedPilesList();
    expect(won).toBeGreaterThan(0);
    expect(piles.some((pile) => pile.item === 'bone')).toBe(true);
    expect(piles.some((pile) => pile.item === 'cabinBlueprint')).toBe(true);
    expect(
      piles.some((pile) => pile.item === 'teepeeBlueprint' || pile.item === 'largeCabinBlueprint'),
    ).toBe(false);
  });
  it('keeps legacy item and build indices unchanged', () => {
    expect(buildableKindIndex('cabin')).toBe(1);
    expect(itemIndex('bone')).toBe(11);
  });
  it('strictly decodes knowledge and feedback', () => {
    expect(decodeServerMessage(encodeHomeSkills(5))).toEqual({ type: 'homeSkills', skills: 5 });
    expect(decodeServerMessage(new Uint8Array([0x31, 8]).buffer)).toBeNull();
    expect(
      decodeServerMessage(
        encodeHomeBuildFeedback({ kind: 'teepee', homeId: 7, reason: 'occupied' }),
      ),
    ).toMatchObject({ reason: 'occupied', homeId: 7 });
    expect(decodeServerMessage(new Uint8Array([0x32, 0, 0, 0, 0]).buffer)).toBeNull();
  });
  for (const kind of HOME_TIERS)
    it(`uses matching room and doorway dimensions for ${kind}`, () => {
      const at = homeSpot(HOME_ENTRY, kind),
        scale = homeRoomScale(kind);
      expect(at.z).toBeCloseTo(HOME_ENTRY.z * scale);
      expect(isLeavingRoom(HOME_ENTRY.x * scale, 3 * scale, 0, 1, true, kind)).toBe(true);
      expect(homeRoomColliders(kind).length).toBeGreaterThanOrEqual(8);
      const home: BuiltProp = { id: 7, kind, x: 0, z: 0, yaw: 0, lit: false };
      expect(cabinDoorway(home).z).toBeGreaterThan(
        (cabinCollider(home) as { halfZ: number }).halfZ,
      );
      expect(blueprintForHome(kind) === null).toBe(kind === 'tent');
    });
});
