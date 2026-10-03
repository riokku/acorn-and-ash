import { afterEach, describe, expect, it } from 'vitest';
import { createWorld, type World } from 'koota';
import {
  blueprintDropChance,
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  createInput,
  buildEncounterSites,
  createWildernessTerrain,
  buildTestClearing,
  buildWilderness,
  createFlatTerrain,
  createCollisionWorld,
  RaidDirector,
  createActionState,
  encodeRaidNews,
  decodeServerMessage,
  TICK_HZ,
  type RaidFighter,
  type EncounterSite,
} from '../src/index';
const sims: WorldSimulation[] = [];
const worlds: World[] = [];
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose();
  for (const world of worlds.splice(0)) world.destroy();
});
function simulation() {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  return sim;
}
function addPlayer(sim: WorldSimulation, id: number, skills = 0, misses = 5) {
  sim.addPlayer(
    id,
    {
      netId: id,
      x: 0,
      y: 0,
      z: 0,
      facingYaw: 0,
      items: [],
      hunger: 100,
      homeSkills: skills,
      blueprintMisses: misses,
    },
    `player-${id}`,
  );
  sim.placePlayer(id, { x: 0, y: 0, z: 0 }, 0);
}
function kill(sim: WorldSimulation, killer = 1, helper?: number) {
  const raid = sim.startRaid(killer, [helper === undefined ? 'minion' : 'warrior']);
  expect(raid).not.toBeNull();
  const id = sim.raids.raidersOf(raid!)[0]!;
  sim.raids.placeRaider(id, { x: 0, y: 0, z: -1.4 }, Math.PI);
  if (helper !== undefined)
    sim.raids.blowLands(helper, { x: 0, y: 0, z: 0 }, 0, { kind: 'strike' }, 0);
  sim.raids.blowLands(killer, { x: 0, y: 0, z: 0 }, 0, { kind: 'strike' }, 0);
}
function forest(kind: EncounterSite['kind'] = 'wanderer') {
  const world = createWorld();
  worlds.push(world);
  const fighters: RaidFighter[] = [
    {
      netId: 1,
      position: { x: 0, y: 0, z: 0 },
      aimYaw: 0,
      outdoors: true,
      down: false,
      action: createActionState(),
    },
  ];
  const site: EncounterSite = { id: 1, kind, x: 40, z: 0, yaw: 0 };
  const director = new RaidDirector(
    world,
    1234,
    {
      collision: createCollisionWorld(createFlatTerrain(), []),
      water: [],
      fighters: () => fighters,
      strikePlayer: () => {},
      dropLoot: () => {},
    },
    { intervalMinSeconds: 100000, encounterSites: [site] },
  );
  let tick = 0;
  const step = (count = 1, night = false) => {
    for (let i = 0; i < count; i++) director.step(++tick, night);
  };
  return { director, fighters, site, step };
}
describe('blueprint progress and cooperative rewards', () => {
  it('increases to a guaranteed sixth eligible kill and clamps invalid saved streaks', () => {
    [0.3, 0.45, 0.6, 0.75, 0.9, 1].forEach((chance, misses) =>
      expect(blueprintDropChance(misses)).toBeCloseTo(chance),
    );
    expect(blueprintDropChance(-5)).toBe(0.3);
    expect(blueprintDropChance(NaN)).toBe(0.3);
    expect(blueprintDropChance(99)).toBe(1);
  });
  it('gives each contributor a protected next-tier reward, but not a spectator', () => {
    const sim = simulation();
    addPlayer(sim, 1);
    addPlayer(sim, 2, 1);
    addPlayer(sim, 3);
    kill(sim, 1, 2);
    expect(sim.droppedPilesList(1).map((p) => p.item)).toEqual(['teepeeBlueprint']);
    expect(sim.droppedPilesList(2).map((p) => p.item)).toEqual(['cabinBlueprint']);
    expect(sim.droppedPilesList(3)).toEqual([]);
    expect(sim.blueprintMissesOf(1)).toBe(0);
    expect(sim.blueprintMissesOf(2)).toBe(0);
    expect(sim.blueprintMissesOf(3)).toBe(5);
    expect(sim.drainBlueprintProgressChanges().sort()).toEqual([1, 2]);
  });
  it('refuses a forged pickup of another contributor’s protected reward', () => {
    const sim = simulation();
    addPlayer(sim, 1);
    addPlayer(sim, 2);
    kill(sim, 1, 2);
    const other = sim.droppedPilesList(2)[0]!;
    sim.placePlayer(1, { x: other.x, y: 0, z: other.z }, 0);
    sim.requestLoot(1, { kind: 'pile', id: other.id });
    sim.queueInput(1, createInput(1, 0, 0, 0));
    sim.step(1000);
    expect(sim.inventoryOf(1).teepeeBlueprint ?? 0).toBe(0);
    expect(sim.droppedPilesList(2).some((p) => p.id === other.id)).toBe(true);
    const own = sim.droppedPilesList(1)[0]!;
    sim.requestLoot(1, { kind: 'pile', id: own.id });
    sim.queueInput(1, createInput(2, 0, 0, 0));
    sim.step(1050);
    expect(sim.inventoryOf(1).teepeeBlueprint).toBe(1);
  });
  it('restores streak and reward protection after reconnect with a new network ID', () => {
    const sim = simulation();
    addPlayer(sim, 1);
    kill(sim);
    const pile = sim.droppedPilesList(1)[0]!;
    const savedPile = sim.persistedPile(pile.id)!;
    expect(savedPile.ownerKey).toBe('player-1');
    const saved = sim.persistablePlayers()[0]!;
    const back = simulation();
    back.restoreDroppedPiles([savedPile], 100);
    back.addPlayer(9, saved, 'player-1');
    back.addPlayer(10, undefined, 'other');
    expect(back.blueprintMissesOf(9)).toBe(0);
    expect(back.droppedPilesList(9)).toHaveLength(1);
    expect(back.droppedPilesList(10)).toHaveLength(0);
  });
  it('saves a missed-roll streak and continues it after reconnect', () => {
    const sim = simulation();
    addPlayer(sim, 1, 0, 4);
    const saved = sim.persistablePlayers()[0]!;
    const back = simulation();
    back.addPlayer(8, saved, 'player-1');
    expect(back.blueprintMissesOf(8)).toBe(4);
    kill(back, 8);
    if (back.droppedPilesList(8).some((p) => p.item === 'teepeeBlueprint')) {
      expect(back.blueprintMissesOf(8)).toBe(0);
    } else {
      expect(back.blueprintMissesOf(8)).toBe(5);
      for (let tick = 0; tick < 36; tick++) back.step(tick * 50);
      back.placePlayer(8, { x: 0, y: 0, z: 0 }, 0);
      kill(back, 8);
      expect(back.droppedPilesList(8).some((p) => p.item === 'teepeeBlueprint')).toBe(true);
    }
  });
  it('does not roll or alter a streak when all housing skills are known', () => {
    const sim = simulation();
    addPlayer(sim, 1, 7, 4);
    kill(sim);
    expect(sim.droppedPilesList(1)).toHaveLength(0);
    expect(sim.blueprintMissesOf(1)).toBe(4);
    expect(sim.drainBlueprintProgressChanges()).toHaveLength(0);
  });
  it('actually pays a blueprint within six kills for every tested seed', () => {
    for (let seed = 1; seed <= 24; seed++) {
      const sim = new WorldSimulation({ seed });
      sims.push(sim);
      addPlayer(sim, 1, 0, 0);
      let kills = 0;
      while (!sim.droppedPilesList(1).some((p) => p.item === 'teepeeBlueprint') && kills < 6) {
        kill(sim);
        kills++;
        for (let tick = 0; tick < 36; tick++) sim.step((kills * 36 + tick) * 50);
        sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
      }
      expect(kills).toBeLessThanOrEqual(6);
      expect(sim.droppedPilesList(1).some((p) => p.item === 'teepeeBlueprint')).toBe(true);
      sim.dispose();
      sims.pop();
    }
  });
});
describe('exploration skeleton encounters', () => {
  it('uses deterministic glades clear of existing scenery', () => {
    const seed = DEFAULT_WORLD_SEED;
    const terrain = createWildernessTerrain(seed),
      clearing = buildTestClearing(seed),
      wilderness = buildWilderness(seed, terrain);
    const colliders = [...clearing.colliders, ...wilderness.colliders];
    const sites = buildEncounterSites(seed, terrain, colliders, clearing.water);
    expect(sites).toHaveLength(6);
    expect(buildEncounterSites(seed, terrain, colliders, clearing.water)).toEqual(sites);
    expect(new Set(sites.map((s) => s.kind)).size).toBe(3);
    expect(sites.every((s) => Math.hypot(s.x, s.z) >= 62)).toBe(true);
  });
  it('wanders without warning or pursuing distant players; engages only when approached', () => {
    const a = forest();
    a.step(TICK_HZ);
    expect(a.director.raiderCount).toBe(1);
    expect(a.director.drainNews()).toEqual([]);
    const id = a.director.raidersList()[0]!.id;
    const before = { ...a.director.positionOf(id)! };
    a.step(TICK_HZ * 5);
    expect(a.director.positionOf(id)).not.toEqual(before);
    expect(a.director.drainNews()).toEqual([]);
    a.fighters[0] = { ...a.fighters[0]!, position: { x: 39, y: 0, z: 0 } };
    a.step();
    expect(a.director.drainNews()[0]?.kind).toBe('wanderer');
  });
  it('keeps a two-skeleton guard at ruins', () => {
    const a = forest('ruins');
    a.step(TICK_HZ);
    expect(
      a.director
        .raidersList()
        .map((r) => r.kind)
        .sort(),
    ).toEqual(['mage', 'warrior']);
    a.step(TICK_HZ * 30);
    for (const raider of a.director.raidersList()) {
      const at = a.director.positionOf(raider.id)!;
      expect(Math.hypot(at.x - a.site.x, at.z - a.site.z)).toBeLessThan(4);
    }
  });
  it('patrols only at night and leaves quietly when dawn arrives', () => {
    const a = forest('patrol');
    a.step(TICK_HZ);
    expect(a.director.raiderCount).toBe(0);
    a.step(TICK_HZ, true);
    expect(a.director.raiderCount).toBe(3);
    a.step(TICK_HZ * 8);
    expect(a.director.raiderCount).toBe(0);
    expect(a.director.encounterRestState()).toHaveLength(1);
  });
  it('lets a retreating player escape instead of chasing back to their home', () => {
    const a = forest();
    a.step(TICK_HZ);
    a.fighters[0] = { ...a.fighters[0]!, position: { x: 39, y: 0, z: 0 } };
    a.step();
    a.director.drainNews();
    a.fighters[0] = { ...a.fighters[0]!, position: { x: 0, y: 0, z: 0 } };
    a.step(TICK_HZ * 20);
    const at = a.director.positionOf(a.director.raidersList()[0]!.id)!;
    expect(Math.hypot(at.x - a.site.x, at.z - a.site.z)).toBeLessThan(5);
    expect(a.director.drainNews()).toEqual([]);
  });
  it('does not materialize a new encounter under the player', () => {
    const a = forest();
    a.fighters[0] = { ...a.fighters[0]!, position: { x: 40, y: 0, z: 0 } };
    a.step(TICK_HZ * 2);
    expect(a.director.raiderCount).toBe(0);
  });
  it('honors saved clearing cooldowns after the world wakes', () => {
    const a = forest();
    a.director.restoreEncounterRest([[1, 600 * TICK_HZ]]);
    a.step(TICK_HZ * 3);
    expect(a.director.raiderCount).toBe(0);
  });
  for (const kind of ['wanderer', 'ruins', 'patrol', 'encounterCleared'] as const)
    it(`round trips the ${kind} encounter message`, () => {
      const news = { kind, raidId: 8, targetNetId: 1, count: 2, x: 40, z: 0 };
      expect(decodeServerMessage(encodeRaidNews(news))).toEqual({ type: 'raidNews', news });
    });
});
