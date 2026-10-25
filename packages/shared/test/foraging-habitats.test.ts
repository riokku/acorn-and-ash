import { afterEach, expect, it } from 'vitest';
import { WorldSimulation } from '../src/sim/world-sim';
import {
  isForageHabitat,
  forestCanopy,
  forageRegrowSpot,
  forageHabitatHint,
} from '../src/sim/foraging-habitats';
import { createFlatTerrain } from '../src/world/terrain';
import { encodeGatherPatches, decodeServerMessage } from '../src/net/protocol';
import { buildForageHabitats } from '../src/sim/foraging-habitats';
import { DEFAULT_WORLD_SEED } from '../src/constants';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function world(seed = DEFAULT_WORLD_SEED) {
  const sim = new WorldSimulation({ seed, raidIntervalSeconds: 86400 });
  worlds.push(sim);
  return sim;
}
it('adds stable unique one-byte colony IDs without moving existing forage', () => {
  const sim = world();
  const colonies = sim.gatherPatchesList().filter((p) => p.id >= 243 && p.id <= 248);
  expect(colonies.map((p) => p.id)).toEqual([243, 244, 245, 246, 247, 248]);
  expect(colonies.filter((p) => p.item === 'berry')).toHaveLength(3);
  expect(colonies.filter((p) => p.item === 'mushroom')).toHaveLength(3);
  expect(new Set(sim.gatherPatchesList().map((p) => p.id)).size).toBe(
    sim.gatherPatchesList().length,
  );
  const decoded = decodeServerMessage(encodeGatherPatches(colonies));
  expect(decoded?.type).toBe('gatherPatches');
  if (decoded?.type !== 'gatherPatches') throw new Error('missing colonies');
  expect(decoded.patches.map((p) => p.id)).toEqual([243, 244, 245, 246, 247, 248]);
  decoded.patches.forEach((p, index) => {
    expect(p.x).toBeCloseTo(colonies[index]!.x, 1);
    expect(p.z).toBeCloseTo(colonies[index]!.z, 1);
  });
});
it('keeps picked-clean colonies near remembered ground through repeated regrowth and reload', () => {
  const sim = world(),
    initial = sim.gatherPatchesList().filter((p) => isForageHabitat(p.id));
  for (let generation = 0; generation < 4; generation++) {
    sim.restorePatches(initial.map((p) => ({ ...p, remaining: 0, generation, emptiedAtMs: 0 })));
    sim.regrowPatches(100000000);
    for (const before of initial) {
      const after = sim.gatherPatchesList().find((p) => p.id === before.id)!;
      expect(after.remaining).toBeGreaterThan(0);
      expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeLessThanOrEqual(1.50001);
    }
  }
  const restored = world();
  restored.restorePatches(initial.map((p) => sim.persistedPatch(p.id)!));
  expect(restored.gatherPatchesList().filter((p) => isForageHabitat(p.id))).toEqual(
    sim.gatherPatchesList().filter((p) => isForageHabitat(p.id)),
  );
});
it('places berries in canopy gaps and skips blocked ground', () => {
  const props = [{ id: 1, kind: 'pine' as const, x: 60, z: 0, rotationY: 0, scale: 1 }];
  const cover = forestCanopy(props);
  expect(cover(60, 0)).toBe(true);
  expect(cover(42, 0)).toBe(false);
  const homes = buildForageHabitats(1234, [], props, createFlatTerrain(), (x, z) => x < 0 && z < 0);
  expect(homes).toHaveLength(3);
  expect(
    buildForageHabitats(1234, [], props, createFlatTerrain(), (x, z) => x < 0 && z < 0),
  ).toEqual(homes);
  expect(homes.every((home) => home.x < 0 && home.z < 0 && !cover(home.x, home.z))).toBe(true);
  expect(forageRegrowSpot(1234, homes[0]!, 1, () => false)).toBeNull();
  expect(buildForageHabitats(1234, [], props, createFlatTerrain(), () => false)).toEqual([]);
});
it('rejects corrupt saved colony positions and explains an empty habitat without promising a harvest', () => {
  const sim = world(),
    patch = sim.gatherPatchesList().find((p) => isForageHabitat(p.id))!;
  sim.restorePatches([{ ...patch, x: 999, remaining: 6, generation: 1, emptiedAtMs: 0 }]);
  expect(sim.gatherPatchesList().find((p) => p.id === patch.id)!.x).toBe(patch.x);
  expect(forageHabitatHint([patch], patch.x, patch.z)).toContain('Remember this spot');
  expect(forageHabitatHint([{ ...patch, remaining: 0 }], patch.x, patch.z)).toContain(
    'picked clean',
  );
  expect(forageHabitatHint([patch], 999, 999)).toBeNull();
});

it('waits rather than escaping its habitat when a cabin covers the colony', () => {
  const sim = world(),
    patch = sim.gatherPatchesList().find((p) => p.id === 246)!;
  sim.restoreBuiltProps([
    {
      id: 777,
      kind: 'cabin',
      x: patch.x,
      z: patch.z,
      yaw: 0,
      lit: false,
      ownerKey: 'forager',
      litUntilMs: null,
    },
  ]);
  sim.restorePatches([{ ...patch, remaining: 0, generation: 0, emptiedAtMs: 0 }]);
  sim.regrowPatches(100000000);
  const after = sim.gatherPatchesList().find((p) => p.id === patch.id)!;
  expect(after.remaining).toBe(0);
  expect(Math.hypot(after.x - patch.x, after.z - patch.z)).toBeLessThanOrEqual(1.5);
});

it('does not introduce a fresh colony inside a cabin from an older world save', () => {
  const sim = world(),
    patch = sim.gatherPatchesList().find((p) => p.id === 246)!;
  sim.restoreBuiltProps([
    {
      id: 777,
      kind: 'cabin',
      x: patch.x,
      z: patch.z,
      yaw: 0,
      lit: false,
      ownerKey: 'forager',
      litUntilMs: null,
    },
  ]);
  sim.restorePatches([]); // Older saves have no rows for these new IDs.
  expect(sim.gatherPatchesList().find((p) => p.id === patch.id)!.remaining).toBe(0);
  sim.restorePatches([{ ...patch, remaining: 6, generation: 1, emptiedAtMs: 0 }]);
  expect(sim.gatherPatchesList().find((p) => p.id === patch.id)!.remaining).toBe(0);
});
