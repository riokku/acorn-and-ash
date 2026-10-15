import { afterEach, expect, it } from 'vitest';
import {
  WildfireSimulation,
  FIRE_LIMIT,
  FIRE_TREE_SECONDS,
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  encodeWildfire,
  decodeServerMessage,
  type FireTarget,
  TICK_HZ,
  HEALTH_MAX,
  createPlayerMotion,
  createInput,
  createCollisionWorld,
  createFlatTerrain,
  stepPlayer,
  BLIZZARD_SPEED,
  clockShiftForSeason,
  PlayerButton,
  HUNGER_MAX,
  PROP_KINDS,
  type SeasonId,
  type ItemId,
} from '../src/index';
const tree = (id: number, x = 0): FireTarget => ({
  id,
  kind: 'tree',
  x,
  y: 0,
  z: 0,
  height: 6,
  radius: 1,
});
const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((sim) => sim.dispose()));

it('spreads only within reach, once per source, with bounded generations and capacity', () => {
  const targets = Array.from({ length: 100 }, (_, i) => tree(i, i < 99 ? i * 0.04 : 90));
  const fire = new WildfireSimulation();
  fire.ignite(targets[0]!, 0);
  fire.advance(42, 11_999, targets);
  expect(fire.fires.size).toBe(1);
  fire.advance(42, 12_000, targets);
  expect(fire.fires.size).toBeGreaterThan(1);
  expect(fire.fires.size).toBeLessThanOrEqual(FIRE_LIMIT);
  expect(fire.fires.has('tree:99')).toBe(false);
  for (let time = 24_000; time < 150_000; time += 12_000) {
    fire.advance(42, time, targets);
    expect([...fire.fires.values()].every((f) => f.generation <= 3)).toBe(true);
    expect(fire.fires.size).toBeLessThanOrEqual(FIRE_LIMIT);
  }
  expect(fire.fires.size).toBe(0);
});
it('survives save/restore without repeating spread, and cancels fire on chopped trees', () => {
  const fire = new WildfireSimulation();
  fire.ignite(tree(1), 0);
  fire.advance(2, 12_000, [tree(1)]);
  fire.lastStrike = 7;
  const restored = new WildfireSimulation();
  restored.restore(fire.save(), [tree(1)]);
  expect(restored.save()).toBe(fire.save());
  expect(restored.advance(2, 13_000, [])).toEqual([]);
  expect(restored.fires.size).toBe(0);
});
it('keeps a contained ignition on its first tree, including after save/restore', () => {
  const targets = Array.from({ length: 20 }, (_, i) => tree(i, i * 0.1));
  const fire = new WildfireSimulation();
  fire.ignite(targets[0]!, 0, 0, false);
  const restored = new WildfireSimulation();
  restored.restore(fire.save(), targets);
  restored.advance(42, 12_000, targets);
  expect([...restored.fires.keys()]).toEqual(['tree:0']);
  expect(restored.advance(42, FIRE_TREE_SECONDS * 1000, targets)).toEqual([
    expect.objectContaining({ id: 0 }),
  ]);
});
it('stops an existing summer fire spreading when the dry season ends', () => {
  const targets = Array.from({ length: 20 }, (_, i) => tree(i, i * 0.1));
  const fire = new WildfireSimulation();
  fire.ignite(targets[0]!, 0);
  fire.advance(42, 1000, targets, false);
  fire.advance(42, 12_000, targets, true);
  expect([...fire.fires.keys()]).toEqual(['tree:0']);
});

function torchWorld(season: SeasonId, equipped: ItemId | null = 'torch') {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  sims.push(sim);
  sim.setCalendarShift(clockShiftForSeason(sim.seed, 0, season));
  sim.addPlayer(1, {
    netId: 1,
    x: 0,
    y: 0,
    z: 0,
    facingYaw: 0,
    hunger: HUNGER_MAX,
    items: [
      { item: 'torch', count: 1 },
      { item: 'axe', count: 1 },
    ],
    equippedItem: equipped,
  });
  const target = sim.clearing.props.find((prop) => prop.kind === 'oak')!;
  const radius = PROP_KINDS[target.kind].colliderRadius * target.scale;
  const position = { x: target.x, y: target.y ?? 0, z: target.z + radius + 1 };
  sim.placePlayer(1, position, 0);
  return { sim, target, position };
}
function torchSwing(sim: WorldSimulation, yaw = 0, buttons = PlayerButton.Swing) {
  for (let i = 1; i <= TICK_HZ; i++) {
    sim.queueInput(1, createInput(i, 0, 0, 0, i === 1 ? buttons : 0, yaw));
    sim.step(i * 50);
  }
}
it.each(['spring', 'summer', 'autumn', 'winter'] as const)(
  'applies %s torch ignition and spread rules to a real player swing',
  (season) => {
    const { sim, target } = torchWorld(season);
    torchSwing(sim);
    const fire = sim.wildfire.fires.get(`tree:${target.id}`);
    if (season === 'winter') expect(fire).toBeUndefined();
    else {
      expect(fire).toMatchObject({ id: target.id, generation: 0, spread: season !== 'summer' });
      expect(sim.isFelled(target.id)).toBe(false);
      expect(sim.drainChopEvents()).toEqual([]);
      // The torch uses the same nearby-tree spread as lightning, including its distance limit.
      const neighbours = [
        fire!,
        ...Array.from({ length: 20 }, (_, i) => tree(90000 + i, fire!.x + i * 0.1)).map((t) => ({
          ...t,
          z: fire!.z,
        })),
        { ...tree(99999, fire!.x + 20), z: fire!.z },
      ];
      sim.wildfire.advance(42, fire!.startedAt + 12_000, neighbours);
      if (season === 'summer') expect(sim.wildfire.fires.size).toBeGreaterThan(1);
      else expect(sim.wildfire.fires.size).toBe(1);
      expect(sim.wildfire.fires.has('tree:99999')).toBe(false);
    }
  },
);
it.each(['carrying', 'idle', 'behind', 'distant', 'above'] as const)(
  'does not ignite a tree when the player is %s',
  (caseName) => {
    const { sim, position } = torchWorld('summer', caseName === 'carrying' ? 'axe' : 'torch');
    if (caseName === 'distant') sim.placePlayer(1, { ...position, z: position.z + 8 }, 0);
    if (caseName === 'above') sim.placePlayer(1, { ...position, y: position.y + 40 }, 0);
    torchSwing(
      sim,
      caseName === 'behind' ? Math.PI : 0,
      caseName === 'idle' ? 0 : PlayerButton.Swing,
    );
    expect(sim.wildfire.fires.size).toBe(0);
  },
);
it('round-trips fires and lightning and rejects truncated or invalid network data', () => {
  const fire = new WildfireSimulation();
  fire.ignite(tree(1), 1000);
  fire.lightning = { serial: 2, x: 1, y: 10, z: 3 };
  const state = { ...fire.view(2000), testWeather: null };
  const encoded = encodeWildfire(state);
  expect(decodeServerMessage(encoded)).toEqual({ type: 'wildfire', ...state });
  expect(decodeServerMessage(encoded.slice(0, -1))).toBeNull();
  new DataView(encoded).setFloat32(35, NaN, true);
  expect(decodeServerMessage(encoded)).toBeNull();
});
it('slows walking by 22 percent in blizzards without affecting indoor movement', () => {
  const outdoor = createCollisionWorld(createFlatTerrain(0), []);
  const indoor = createCollisionWorld(createFlatTerrain(0), []);
  outdoor.movementScale = BLIZZARD_SPEED;
  const slow = createPlayerMotion({ x: 0, y: 0, z: 0 });
  const normal = createPlayerMotion({ x: 0, y: 0, z: 0 });
  for (let i = 0; i < 40; i++) {
    stepPlayer(slow, createInput(i, 0, 1), 0.05, outdoor);
    stepPlayer(normal, createInput(i, 0, 1), 0.05, indoor);
  }
  expect(slow.velocity.z / normal.velocity.z).toBeCloseTo(BLIZZARD_SPEED);
});
it('burns a tree to a saved stump and hurts a nearby player', () => {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  sims.push(sim);
  sim.addPlayer(1);
  const target = sim.clearing.props.find((prop) => sim.igniteTree(prop.id))!;
  expect(target).toBeDefined();
  sim.placePlayer(1, { x: target.x + 1.8, y: 0, z: target.z }, 0);
  sim.tick = TICK_HZ - 1;
  sim.step(1000);
  expect(sim.healthOf(1)).toBeLessThan(HEALTH_MAX);
  sim.tick = FIRE_TREE_SECONDS * TICK_HZ - 1;
  sim.step(FIRE_TREE_SECONDS * 1000);
  expect(sim.changedTrees().find((t) => t.treeId === target.id)?.felled).toBe(true);
  expect(sim.drainTreeChanges()).toContain(target.id);
});
it('destroys a burning home, drops chest contents, and evacuates its occupants', () => {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  sims.push(sim);
  sim.restoreBuiltProps([
    { id: 999, kind: 'cabin', x: 0, z: 0, yaw: 0, lit: false, litUntilMs: null, ownerKey: 'owner' },
  ]);
  sim.restoreChest(999, [
    { item: 'log', count: 7 },
    { item: 'stick', count: 9 },
    ...Array(8).fill(null),
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0, 999);
  sim.restoreWildfire(
    JSON.stringify({
      fires: [{ ...tree(999), kind: 'building', startedAt: 0, generation: 3, spread: true }],
      lastStrike: 0,
    }),
  );
  sim.tick = 90 * TICK_HZ - 1;
  sim.step(90_000);
  expect(sim.builtPropsList()).toEqual([]);
  expect(sim.removeExpiredBuilds(90_000)).toContain(999);
  expect(sim.spaceOf(1)).toBe(0);
  expect(sim.droppedPilesList()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ item: 'log', count: 7 }),
      expect.objectContaining({ item: 'stick', count: 9 }),
    ]),
  );
});

it('produces occasional summer lightning ignitions, never winter lightning', () => {
  const sim = new WorldSimulation({
    seed: DEFAULT_WORLD_SEED,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
  });
  sims.push(sim);
  sim.addPlayer(1);
  sim.setTestWeather('storm');
  let strikes = 0;
  let ignitions = 0;
  for (let slot = 1; slot <= 20; slot++) {
    sim.tick = slot * 18 * TICK_HZ - 1;
    sim.setCalendarShift(clockShiftForSeason(sim.seed, (sim.tick + 1) * 50, 'summer'));
    sim.step(slot * 18_000);
    if (sim.wildfire.lightning?.serial === slot) strikes++;
    if (sim.wildfire.fires.size > 0) ignitions++;
    sim.wildfire.fires.clear();
  }
  expect(strikes).toBeGreaterThan(10);
  expect(ignitions).toBeGreaterThan(0);
  expect(ignitions).toBeLessThan(strikes);
  const last = sim.wildfire.lightning;
  sim.tick = 21 * 18 * TICK_HZ - 1;
  sim.setCalendarShift(clockShiftForSeason(sim.seed, (sim.tick + 1) * 50, 'winter'));
  sim.step(21 * 18_000);
  expect(sim.wildfire.lightning).toEqual(last);
});
