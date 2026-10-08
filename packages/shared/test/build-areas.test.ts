import { afterEach, describe, expect, it } from 'vitest';
import {
  PLAYABLE_HALF_EXTENT,
  HOME_BUILD_RADII,
  buildableFootprint,
  footprintInBuildArea,
  homeBuildArea,
  checkHomeBuildArea,
  checkPieceBuildArea,
  buildGroundIsLevel,
  WorldSimulation,
  createFlatTerrain,
  DEFAULT_WORLD_SEED,
  createInput,
  checkBuildSpot,
  roundFootprint,
  PROP_KINDS,
  type HomeKind,
  type BuildableKindId,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function world(kind: HomeKind = 'cabin') {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, terrain: createFlatTerrain(4) });
  worlds.push(sim);
  sim.restoreBuiltProps([
    { id: 7, kind, x: 0, z: 15, yaw: 0, lit: false, ownerKey: 'owner', litUntilMs: null },
  ]);
  sim.addPlayer(1, undefined, 'owner');
  sim.addPlayer(2, undefined, 'visitor');
  Object.assign(sim.inventoryOf(1), { log: 30, stick: 20, bag: 1 });
  Object.assign(sim.inventoryOf(2), { log: 30, stick: 20, bag: 1 });
  return sim;
}
function build(sim: WorldSimulation, netId: number, kind: BuildableKindId, x: number, z: number) {
  sim.placePlayer(netId, { x, y: 4, z: z + 4.2 }, 0);
  sim.requestBuild(netId, { kind, x, z, yaw: 0 });
  sim.queueInput(netId, createInput(1, 0, 0, 0));
  sim.step(1000);
}
describe('private building areas', () => {
  it('grows through the agreed home radii', () => {
    expect(HOME_BUILD_RADII).toEqual({ tent: 12, teepee: 18, cabin: 26, largeCabin: 36 });
  });
  it('checks the entire rotated fence, not just its center', () => {
    const area = { x: 0, z: 0, radius: 12 };
    expect(footprintInBuildArea(buildableFootprint('fence', 11.5, 0, 0), area)).toBe(false);
    expect(footprintInBuildArea(buildableFootprint('fence', 11.5, 0, Math.PI / 2), area)).toBe(
      true,
    );
  });
  it('allows touching plots but refuses overlapping ones', () => {
    const area = { x: 0, z: 0, radius: 12 };
    expect(checkHomeBuildArea(area, [{ id: 2, kind: 'tent', x: 24, z: 0 }], [])).toBeNull();
    expect(checkHomeBuildArea(area, [{ id: 2, kind: 'tent', x: 23.99, z: 0 }], [])).toBe(
      'areaOverlap',
    );
  });
  it('protects world edges and encounter clearings', () => {
    expect(checkHomeBuildArea({ x: PLAYABLE_HALF_EXTENT - 10, z: 0, radius: 12 }, [], [])).toBe(
      'worldEdge',
    );
    expect(
      checkHomeBuildArea(
        { x: 0, z: 0, radius: 12 },
        [],
        [{ x: 18, z: 0, radius: 8, name: 'shrine' }],
      ),
    ).toBe('protectedSite');
  });
  it('keeps grandfathered overlapping homes intact but protects new construction', () => {
    const home = { id: 1, kind: 'cabin' as const, x: 0, z: 0 };
    const other = { id: 2, kind: 'tent' as const, x: 14, z: 0 };
    expect(checkPieceBuildArea(buildableFootprint('fence', 4, 0, 0), home, [other], [])).toBe(
      'privateArea',
    );
    expect(
      checkPieceBuildArea(buildableFootprint('campfire', -5, 0, 0), home, [other], []),
    ).toBeNull();
  });
  it('requires a home and refuses objects that protrude beyond its plot', () => {
    const piece = buildableFootprint('campfire', 12, 0, 0);
    expect(checkPieceBuildArea(piece, null, [], [])).toBe('needHome');
    expect(checkPieceBuildArea(piece, { id: 1, kind: 'tent', x: 0, z: 0 }, [], [])).toBe(
      'outsideArea',
    );
  });
  it('accepts flat elevated ground and rejects an uneven foundation', () => {
    const piece = buildableFootprint('tent', 0, 0, 0);
    expect(buildGroundIsLevel(piece, createFlatTerrain(4))).toBe(true);
    expect(
      buildGroundIsLevel(piece, {
        heightAt: (x: number) => x,
        kind: 'slope',
      }),
    ).toBe(false);
  });
  it('validates a real owner build and saves ownership for formerly communal pieces', () => {
    const sim = world();
    build(sim, 1, 'campfire', 1.5, -3);
    const event = sim.drainBuildEvents()[0];
    expect(event?.prop.kind).toBe('campfire');
    expect(event?.ownerKey).toBe('owner');
    expect(sim.inventoryOf(1).log).toBe(26);
  });
  it('refuses an outsider request without spending supplies or changing existing objects', () => {
    const sim = world();
    const existing = sim.builtPropsList();
    build(sim, 2, 'campfire', 1.5, -3);
    expect(sim.drainBuildEvents()).toEqual([]);
    expect(sim.inventoryOf(2).log).toBe(30);
    expect(sim.builtPropsList()).toEqual(existing);
  });
  it('refuses an owner request outside their radius without spending', () => {
    const sim = world('tent');
    build(sim, 1, 'campfire', 1.5, -3);
    expect(sim.drainBuildEvents()).toEqual([]);
    expect(sim.inventoryOf(1).log).toBe(30);
  });
  it('refuses an upgrade that would overlap the next plot, preserving the home and supplies', () => {
    const sim = world('tent');
    sim.restoreBuiltProps([
      {
        id: 8,
        kind: 'tent',
        x: 28,
        z: 15,
        yaw: 0,
        lit: false,
        ownerKey: 'neighbor',
        litUntilMs: null,
      },
    ]);
    const saved = sim.persistablePlayers()[0]!;
    sim.removePlayer(1);
    sim.addPlayer(1, { ...saved, homeSkills: 7 }, 'owner');
    build(sim, 1, 'teepee', 0, 15);
    expect(sim.drainHomeBuildFeedback()[0]?.reason).toBe('area');
    expect(sim.builtPropsList().find((prop) => prop.id === 7)?.kind).toBe('tent');
    expect(sim.inventoryOf(1).log).toBe(30);
  });
  it('establishes a real first tent in a wilderness clearing', () => {
    const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED, terrain: createFlatTerrain(4) });
    worlds.push(sim);
    sim.addPlayer(1, undefined, 'settler');
    Object.assign(sim.inventoryOf(1), { stick: 6 });
    const protectedSites = [
      ...sim.discoverySites.map((site) => ({ ...site, radius: 8 })),
      ...sim.encounterSites.map((site) => ({ ...site, radius: 12, name: site.kind })),
    ];
    const scenery = [...sim.clearing.props, ...sim.wilderness.props].map((prop) =>
      roundFootprint(prop.x, prop.z, PROP_KINDS[prop.kind].colliderRadius * prop.scale, prop.kind),
    );
    let spot: { x: number; z: number } | undefined;
    for (let x = 80; x < 130 && spot === undefined; x += 2)
      for (let z = 80; z < 130 && spot === undefined; z += 2) {
        const proposed = { id: 0, kind: 'tent' as const, x, z };
        if (
          checkHomeBuildArea(homeBuildArea(proposed)!, [], protectedSites) === null &&
          checkBuildSpot(
            buildableFootprint('tent', x, z, 0),
            { x, y: 4, z: z + 4.2 },
            6,
            [],
            scenery,
            true,
          ) === null
        )
          spot = { x, z };
      }
    expect(spot).toBeDefined();
    build(sim, 1, 'tent', spot!.x, spot!.z);
    expect(sim.drainBuildEvents()[0]?.prop).toMatchObject({ kind: 'tent', ...spot });
    expect(sim.inventoryOf(1).stick ?? 0).toBe(0);
  });
});
