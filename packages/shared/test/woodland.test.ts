import { afterEach, expect, it } from 'vitest';
import {
  PLAYABLE_HALF_EXTENT,
  resolveCapsule,
  WorldSimulation,
  DEFAULT_WORLD_SEED,
  WOODLAND_ENCOUNTERS,
  buildWoodlandTracks,
  createInput,
  PlayerButton,
  discoveryKnown,
  encodeDiscoveries,
  decodeServerMessage,
  type PersistedPlayer,
} from '../src/index';
const sims: WorldSimulation[] = [];
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose();
});
function setup() {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(sim);
  for (let id = 1; id <= 3; id++) sim.addPlayer(id, undefined, `player-${id}`);
  let seq = 0,
    now = 1000;
  const tick = (player = 1, buttons = 0) => {
    sim.queueInput(player, createInput(++seq, 0, 0, 0, buttons));
    sim.step((now += 50));
  };
  const visit = (id: number, player = 1) => {
    const site = sim.discoverySites.find((site) => site.id === id)!;
    sim.placePlayer(
      player,
      { x: site.x, y: sim.collision.terrain.heightAt(site.x, site.z), z: site.z },
      0,
    );
    return site;
  };
  const inspect = (player = 1) => {
    tick(player, PlayerButton.Interact);
    tick(player);
  };
  return { sim, tick, visit, inspect };
}
it('provides deterministic tracks for all species leading from the inner woods to clear encounter glades', () => {
  const { sim } = setup();
  const tracks = buildWoodlandTracks(DEFAULT_WORLD_SEED);
  expect(tracks).toEqual(buildWoodlandTracks(DEFAULT_WORLD_SEED));
  expect(tracks).not.toEqual(buildWoodlandTracks(DEFAULT_WORLD_SEED + 1));
  for (const site of WOODLAND_ENCOUNTERS) {
    const species = tracks.filter((track) => track.kind === site.kind);
    expect(species.length).toBeGreaterThan(20);
    expect(Math.hypot(species.at(-1)!.x - site.x, species.at(-1)!.z - site.z)).toBeLessThan(2);
    expect(
      sim.wilderness.props.some(
        (prop) => Math.hypot(prop.x - site.x, prop.z - site.z) < site.radius,
      ),
    ).toBe(false);
  }
});
it('records an elk sketch only while the living elk is calm and nearby', () => {
  const { sim, tick, visit, inspect } = setup();
  const site = visit(4);
  tick();
  inspect();
  expect(discoveryKnown(sim.discoveryStateOf(1).claimed, 4)).toBe(false);
  sim.placeAnimal(1008, { x: site.x + 8.5, y: 0, z: site.z });
  tick();
  inspect();
  expect(discoveryKnown(sim.discoveryStateOf(1).claimed, 4)).toBe(true);
  expect(sim.inventoryOf(1).meat ?? 0).toBe(0);
});
it('keeps a full raccoon cache pending and awards each character once', () => {
  const { sim, visit, inspect } = setup();
  visit(5);
  Object.assign(sim.inventoryOf(1), { log: 100 });
  inspect();
  expect(discoveryKnown(sim.discoveryStateOf(1).claimed, 5)).toBe(false);
  delete sim.inventoryOf(1).log;
  inspect();
  inspect();
  expect(sim.inventoryOf(1).berry).toBe(4);
  expect(sim.inventoryOf(1).mushroom).toBe(3);
  visit(5, 2);
  inspect(2);
  expect(sim.inventoryOf(2).berry).toBe(4);
});
it('does not let friendly raccoons become hunting targets or harm visitors', () => {
  const { sim, tick, visit } = setup();
  const site = visit(5);
  expect(sim.animalInReachOf({ x: site.x, y: 0, z: site.z + 1 }, 0)?.id).not.toBe(1009);
  for (let i = 0; i < 100; i++) tick();
  expect(sim.healthOf(1)).toBe(100);
});
it('requires guardian participation, persists earned eligibility and keeps a full-pack trophy pending', () => {
  const { sim, tick, visit, inspect } = setup();
  const site = visit(6);
  inspect();
  expect(discoveryKnown(sim.discoveryStateOf(1).found, 6)).toBe(false);
  sim.placePlayer(2, { x: site.x + 4, y: 0, z: site.z + 1 }, 0);
  for (const id of [1, 2]) {
    Object.assign(sim.inventoryOf(id), { axe: 1 });
    sim.useItem(id, 'axe');
  }
  // Alternate real light attacks, keeping the fixture's guardian in reach.
  for (let hit = 0; hit < 6; hit++) {
    const player = (hit % 2) + 1;
    sim.placePlayer(
      player,
      { x: site.x, y: sim.collision.terrain.heightAt(site.x, site.z), z: site.z + 1.8 },
      0,
    );
    sim.placeAnimal(1010, {
      x: site.x,
      y: sim.collision.terrain.heightAt(site.x, site.z),
      z: site.z,
    });
    tick(player, PlayerButton.Swing);
    for (let frame = 0; frame < 24; frame++) tick(player);
  }
  for (const id of [1, 2]) expect(discoveryKnown(sim.discoveryStateOf(id).found, 6)).toBe(true);
  expect(discoveryKnown(sim.discoveryStateOf(3).found, 6)).toBe(false);
  const saved = sim.persistablePlayers().find((player) => player.netId === 1)!;
  const restored = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  sims.push(restored);
  restored.addPlayer(4, { ...saved, netId: 4 } satisfies PersistedPlayer, 'player-1');
  expect(discoveryKnown(restored.discoveryStateOf(4).found, 6)).toBe(true);
  visit(6);
  Object.assign(sim.inventoryOf(1), { axe: 0, log: 100 });
  inspect();
  expect(discoveryKnown(sim.discoveryStateOf(1).claimed, 6)).toBe(false);
  delete sim.inventoryOf(1).log;
  inspect();
  inspect();
  expect(sim.inventoryOf(1).guardianTrophy).toBe(1);
  expect(discoveryKnown(sim.discoveryStateOf(1).claimed, 6)).toBe(true);
});
it('supports all seven discovery bits and distinct wildlife refusal messages on the wire', () => {
  for (const notice of ['quiet', 'guardian'] as const)
    expect(decodeServerMessage(encodeDiscoveries({ found: 127, claimed: 64, notice }))).toEqual({
      type: 'discoveries',
      found: 127,
      claimed: 64,
      notice,
    });
});

it('returns the guardian to its hollow when a chase leaves the encounter and keeps woodland animals inside the world', () => {
  const { sim, tick, visit } = setup();
  const site = visit(6);
  sim.placeAnimal(1010, { x: site.x + 20, y: 0, z: site.z });
  sim.placePlayer(1, { x: site.x + 22, y: 0, z: site.z }, 0);
  tick();
  const guardian = sim.snapshotFor(1).find((entity) => entity.netId === 1010)!;
  expect(guardian.vx).toBeLessThan(0);
  expect(guardian.action & 4).toBe(0);
  sim.placeAnimal(1008, { x: PLAYABLE_HALF_EXTENT + 10, y: 0, z: site.z });
  sim.placePlayer(1, { x: PLAYABLE_HALF_EXTENT - 5, y: 0, z: site.z }, 0);
  tick();
  expect(sim.snapshotFor(1).find((entity) => entity.netId === 1008)!.x).toBeLessThan(
    PLAYABLE_HALF_EXTENT,
  );
});

it('guides an approaching visitor back toward the raccoon cache', () => {
  const { sim, tick, visit } = setup();
  const site = visit(5);
  sim.placeAnimal(1009, {
    x: site.x + 3,
    y: sim.collision.terrain.heightAt(site.x + 3, site.z),
    z: site.z,
  });
  sim.placePlayer(1, { x: site.x + 3, y: 0, z: site.z + 2 }, 0);
  tick();
  const raccoon = sim.snapshotFor(1).find((entity) => entity.netId === 1009)!;
  expect(raccoon.vx).toBeLessThan(0);
  expect(raccoon.action & 4).toBe(4);
});

it('keeps adjusted spoor physically clear of trunks, rocks and landmark collision', () => {
  const { sim } = setup();
  const tracks = buildWoodlandTracks(DEFAULT_WORLD_SEED, sim.collision.colliders);
  expect(tracks.length).toBeGreaterThan(60);
  for (const track of tracks) {
    const at = { x: track.x, y: sim.collision.terrain.heightAt(track.x, track.z), z: track.z };
    expect(resolveCapsule(at, 0.4, 1.8, sim.collision)).toBe(false);
  }
});
