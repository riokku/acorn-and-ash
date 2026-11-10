import { describe, expect, it } from 'vitest';

import {
  CROWNBREAKER_HOLD,
  DEFAULT_WORLD_SEED,
  HIGH_PLAINS,
  MAPPED_PLACES,
  MOUNTAINS,
  PLACES,
  PLAINS_LANDMARKS,
  PLAYABLE_HALF_EXTENT,
  SIGHTS,
  SKELETON_TOWN,
  STREAM,
  buildTestClearing,
  createWildernessTerrain,
  streamPointAt,
  whereaboutsAt,
} from '../src/index';

const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
const pond = buildTestClearing(DEFAULT_WORLD_SEED, terrain).water;
const at = (x: number, z: number) => whereaboutsAt(x, z, pond);

describe('the named places', () => {
  it('give every place a name of its own', () => {
    const names = Object.values(PLACES).map((place) => place.name);
    expect(new Set(names).size).toBe(names.length);
    for (const [id, place] of Object.entries(PLACES)) expect(place.id).toBe(id);
  });

  it('put the two regions where the zones are', () => {
    expect(at(60, 60).region).toBe(PLACES.evergreenMountains);
    expect(at(HIGH_PLAINS.x, HIGH_PLAINS.z).region).toBe(PLACES.sunreachHighPlains);
  });

  it('call the clearing Acorn Hollow, and its pond Otter Pond', () => {
    const water = pond[0]!;
    expect(at(water.x, water.z).spot).toBe(PLACES.otterPond);
    // A corner of the clearing, well away from the water.
    const corner = [
      [-28, -28],
      [28, -28],
      [-28, 28],
      [28, 28],
    ].find(([x, z]) => pond.every((c) => Math.hypot(x! - c.x, z! - c.z) > c.radius + 6))!;
    expect(at(corner[0]!, corner[1]!).spot).toBe(PLACES.acornHollow);
    expect(at(60, 60).spot).not.toBe(PLACES.acornHollow);
  });

  it('name the lake out on the water and on its shore, but not back in the trees', () => {
    expect(at(88, -88).spot).toBe(PLACES.mirrormere);
    expect(at(88, -88 + 32 + 3).spot).toBe(PLACES.mirrormere);
    expect(at(88, -20).spot).not.toBe(PLACES.mirrormere);
  });

  it('name the river along its banks, and the falls where it drops', () => {
    const lowland = streamPointAt(STREAM, Math.round(STREAM.count * 0.8));
    expect(at(lowland.x, lowland.z).spot).toBe(PLACES.alderwash);
    expect(at(PLACES.whisperFalls.x, PLACES.whisperFalls.z).spot).toBe(PLACES.whisperFalls);
  });

  it('name the range on its flanks and Old Greywatch along its crest', () => {
    const { ridgeStart: a, ridgeEnd: b } = MOUNTAINS;
    const middle = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    expect(at(middle.x, middle.z).spot).toBe(PLACES.oldGreywatch);
    // Forty metres down the north-east flank.
    expect(at(middle.x + 28, middle.z - 28).spot).toBe(PLACES.greywatchRange);
    expect(at(0, 100).spot).toBeNull();
  });

  it('name the plains landmarks and the dangerous places where they stand', () => {
    const [pass, dunes, mesa] = PLAINS_LANDMARKS;
    expect(at(pass.x, pass.z).spot).toBe(PLACES.windbreakPass);
    expect(at(dunes.x, dunes.z).spot).toBe(PLACES.amberDunes);
    expect(at(mesa.x, mesa.z).spot).toBe(PLACES.crownMesa);
    expect(at(SKELETON_TOWN.x, SKELETON_TOWN.z).spot).toBe(PLACES.bonehollow);
    expect(at(CROWNBREAKER_HOLD.x, CROWNBREAKER_HOLD.z).spot).toBe(PLACES.crownbreakerHold);
    expect(PLACES.bonehollow.kind).toBe('danger');
  });

  it('leave most of the forest with no name beyond its region', () => {
    let unnamed = 0;
    let total = 0;
    for (let x = -280; x <= 280; x += 20)
      for (let z = -280; z <= 280; z += 20) {
        total++;
        if (at(x, z).spot === null) unnamed++;
      }
    expect(unnamed / total).toBeGreaterThan(0.5);
  });

  it('keep every map label inside the world, and every sight tied to a real place', () => {
    for (const place of MAPPED_PLACES) {
      expect(Math.abs(place.x)).toBeLessThan(PLAYABLE_HALF_EXTENT);
      expect(Math.abs(place.z)).toBeLessThan(PLAYABLE_HALF_EXTENT);
    }
    for (const sight of SIGHTS) {
      expect(PLACES[sight.sight].kind).toBe('sight');
      expect(PLACES[sight.from].kind).not.toBe('sight');
    }
  });
});
