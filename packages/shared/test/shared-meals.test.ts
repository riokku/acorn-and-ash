import { afterEach, expect, it } from 'vitest';
import {
  WorldSimulation,
  createInput,
  PlayerButton,
  startMeal,
  MAX_MEAL_TICKS,
  encodeAllies,
  decodeServerMessage,
  type PersistedPlayer,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((world) => world.dispose()));
function party(guest: Partial<PersistedPlayer> = {}) {
  const sim = new WorldSimulation({
    seed: 1234,
    forestEncounters: false,
    hungerEmptyAfterSeconds: Infinity,
    raidIntervalSeconds: 86400,
  });
  worlds.push(sim);
  for (const id of [1, 2])
    sim.addPlayer(
      id,
      {
        netId: id,
        x: 0,
        y: 0,
        z: 0,
        facingYaw: 0,
        hunger: 40,
        health: 100,
        items: [],
        ...(id === 2 ? guest : {}),
      },
      `player-${id}`,
    );
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  sim.placePlayer(2, { x: 1.8, y: 0, z: 0 }, 0);
  sim.inventoryOf(1).forestStew = 4;
  sim.useItem(1, 'forestStew');
  let seq = 0;
  const press = (buttons = PlayerButton.Interact) => {
    sim.queueInput(1, createInput(++seq, 0, 0, 0, buttons));
    sim.step(100000 + sim.tick * 50);
  };
  return { sim, press };
}
it('shares exactly two real servings and applies the normal meal to both companions', () => {
  const { sim, press } = party();
  expect(sim.alliesOf(1).find((p) => p.netId === 2)?.shareMeal).toBe(true);
  press();
  expect(sim.inventoryOf(1).forestStew).toBe(2);
  expect(sim.inventoryOf(2).forestStew ?? 0).toBe(0);
  for (const id of [1, 2]) {
    expect(sim.mealStateOf(id).item).toBe('forestStew');
    expect(sim.mealStateOf(id).ticksLeft).toBeGreaterThanOrEqual(MAX_MEAL_TICKS - 1);
    expect(sim.hungerOf(id)).toBeGreaterThan(40);
  }
  expect(sim.alliesOf(1).some((p) => p.shareMeal)).toBe(false);
  for (let i = 0; i < 10; i++) press();
  expect(sim.inventoryOf(1).forestStew).toBe(2);
  expect(sim.persistablePlayers().find((p) => p.netId === 2)?.meal?.item).toBe('forestStew');
});
it('offers only one nearest eligible companion, with no group duplication', () => {
  const { sim, press } = party();
  sim.addPlayer(3);
  sim.placePlayer(3, { x: 2.3, y: 0, z: 0 }, 0);
  expect(
    sim
      .alliesOf(1)
      .filter((p) => p.shareMeal)
      .map((p) => p.netId),
  ).toEqual([2]);
  press();
  expect(sim.mealStateOf(3).item).toBeNull();
});
it('never replaces an existing companion meal or takes anything from their pack', () => {
  const { sim } = party({ meal: startMeal('berryTea'), items: [{ item: 'log', count: 20 }] });
  expect(sim.alliesOf(1).some((p) => p.shareMeal)).toBe(false);
  const attempt = sim as unknown as { tryShareMeal(host: unknown, at: unknown): boolean };
  // Exercise the authoritative method without E falling through to ordinary solo eating.
  const host = (sim as unknown as { players: Map<number, unknown> }).players.get(1);
  expect(attempt.tryShareMeal(host, { x: 0, y: 0, z: 0 })).toBe(false);
  expect(sim.inventoryOf(1).forestStew).toBe(4);
  expect(sim.inventoryOf(2).log).toBe(20);
  expect(sim.mealStateOf(2)).toEqual(startMeal('berryTea'));
});
it('requires two held prepared servings and a living reachable companion in the same outdoor space', () => {
  const { sim } = party();
  sim.inventoryOf(1).forestStew = 1;
  expect(sim.alliesOf(1).some((p) => p.shareMeal)).toBe(false);
  sim.inventoryOf(1).forestStew = 4;
  sim.useItem(1, 'forestStew'); // normal deliberate solo eating leaves an active meal
  expect(sim.alliesOf(1).some((p) => p.shareMeal)).toBe(false);
  const other = party().sim;
  other.placePlayer(2, { x: 4, y: 0, z: 0 }, 0);
  expect(other.alliesOf(1).some((p) => p.shareMeal)).toBe(false);
  other.placePlayer(2, { x: 1.8, y: 5, z: 0 }, 0);
  expect(other.alliesOf(1).some((p) => p.shareMeal)).toBe(false);
  other.placePlayer(2, { x: 1.8, y: 0, z: 0 }, 0, 123);
  expect(other.alliesOf(1).some((p) => p.shareMeal)).toBe(false);
});
it('shares at full hunger for preparation, without requiring space in the receiver pack', () => {
  const { sim, press } = party({
    hunger: 100,
    items: [
      { item: 'log', count: 20 },
      { item: 'stick', count: 20 },
      { item: 'reed', count: 20 },
      { item: 'stone', count: 20 },
      { item: 'flower', count: 20 },
      { item: 'mushroom', count: 20 },
    ],
  });
  press();
  expect(sim.mealStateOf(2).item).toBe('forestStew');
  expect(sim.hungerOf(2)).toBe(100);
  expect(sim.inventoryOf(2).log).toBe(20);
});
it('adds only a known availability flag to the existing fixed-size cooperative packet', () => {
  const { sim } = party();
  const players = sim.alliesOf(1);
  const packet = encodeAllies(players);
  expect(packet.byteLength).toBe(2 + players.length * 10);
  expect(decodeServerMessage(packet)).toEqual({ type: 'allies', players });
  const impossible = encodeAllies([{ ...players[1]!, inReach: false, shareMeal: true }]);
  expect(decodeServerMessage(impossible)).toBeNull();
  new DataView(packet).setUint8(11, 4);
  expect(decodeServerMessage(packet)).toBeNull();
});

it('keeps busy and downed companions out of the supper offer', () => {
  const busy = party();
  busy.sim.queueInput(2, createInput(1, 0, 1, 0, PlayerButton.Dodge));
  busy.sim.step(100000);
  expect(busy.sim.alliesOf(1).some((p) => p.shareMeal)).toBe(false);
  const downed = party();
  (
    downed.sim as unknown as { raiderStrikesPlayer(id: number, damage: number, tick: number): void }
  ).raiderStrikesPlayer(2, 1000, 0);
  expect(downed.sim.alliesOf(1).some((p) => p.shareMeal)).toBe(false);
});
