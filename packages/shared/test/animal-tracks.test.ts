import { expect, it } from 'vitest';
import {
  AnimalTrailHistory,
  FRESH_TRACK_SECONDS,
  MAX_FRESH_TRACKS,
  MAX_VISIBLE_TRACKS,
  freshTrackHint,
} from '../src/sim/animal-tracks';
import { encodeAnimalTracks, decodeServerMessage } from '../src/net/protocol';
import { WorldSimulation, SnapshotFlag } from '../src/sim/world-sim';

function trail() {
  const history = new AnimalTrailHistory();
  history.observe(1, 'elk', 0, 0, true);
  for (let i = 1; i <= 8; i++) history.observe(1, 'elk', i * 0.25, 0, true);
  return history;
}
it('records actual travel, direction and species, not standing still, spawning or teleporting', () => {
  const history = trail();
  expect(history.near(0, 0)).toHaveLength(1);
  expect(history.near(0, 0)[0]).toMatchObject({ kind: 'elk', yaw: -Math.PI / 2, freshness: 1 });
  history.observe(1, 'elk', 2, 0, true);
  history.observe(1, 'elk', 100, 0, true);
  history.observe(2, 'woodlandGuardian', 1, 1, true);
  expect(history.near(0, 0)).toHaveLength(1);
  expect(history.near(100, 0)).toHaveLength(0);
});
it('washes prints away faster in rain and snow and stops laying them in water', () => {
  const dry = trail(),
    rain = trail(),
    snow = trail();
  dry.age(45, 'clear');
  rain.age(45, 'rain');
  snow.age(30, 'blizzard');
  expect(dry.near(0, 0)[0]!.freshness).toBeCloseTo(0.75);
  expect(rain.near(0, 0)).toHaveLength(0);
  expect(snow.near(0, 0)).toHaveLength(0);
  for (let i = 8; i < 24; i++) dry.observe(1, 'elk', i * 0.25, 0, false);
  expect(dry.near(0, 0)).toHaveLength(1);
  dry.age(FRESH_TRACK_SECONDS, 'clear');
  expect(dry.near(0, 0)).toHaveLength(0);
});
it('bounds shared history and nearby packets and shares the same marks with later viewers', () => {
  const history = new AnimalTrailHistory();
  history.observe(1, 'fox', 0, 0, true);
  for (let i = 0; i < MAX_FRESH_TRACKS * 8; i++)
    history.observe(1, 'fox', Math.sin(i * 0.05) * 5, Math.cos(i * 0.05) * 5, true);
  expect(history.near(0, 0).length).toBeLessThanOrEqual(MAX_VISIBLE_TRACKS);
  expect(history.near(0, 0)).toEqual(history.near(0.1, 0));
  expect(history.near(100, 100)).toEqual([]);
});
it('round-trips bounded tracks with a fixed wire ID and rejects malformed records', () => {
  const tracks = trail().near(0, 0),
    encoded = encodeAnimalTracks(tracks);
  expect(new Uint8Array(encoded)[0]).toBe(0x4d);
  const decoded = decodeServerMessage(encoded);
  expect(decoded?.type).toBe('animalTracks');
  if (decoded?.type !== 'animalTracks') throw new Error('tracks not decoded');
  expect(decoded.tracks[0]!.x).toBeCloseTo(tracks[0]!.x, 4);
  expect(decoded.tracks[0]!.freshness).toBe(1);
  expect(decodeServerMessage(encodeAnimalTracks([]))).toEqual({ type: 'animalTracks', tracks: [] });
  expect(decodeServerMessage(encoded.slice(0, -1))).toBeNull();
  const malformed = encoded.slice(0);
  new DataView(malformed).setUint8(4, 255);
  expect(decodeServerMessage(malformed)).toBeNull();
  const nan = encoded.slice(0);
  new DataView(nan).setFloat32(5, NaN, true);
  expect(decodeServerMessage(nan)).toBeNull();
  expect(freshTrackHint(tracks[0]!)).toContain('Fresh elk hoofprints');
  expect(freshTrackHint({ ...tracks[0]!, freshness: 0.2 })).toContain('Faint');
});
it('retains real wildlife movement for outdoor viewers and clears it indoors or out of range', () => {
  const sim = new WorldSimulation({ seed: 1234, raidIntervalSeconds: 86400 });
  try {
    sim.addPlayer(1);
    sim.addPlayer(2);
    sim.placePlayer(1, { x: 0, y: 0, z: -32 }, 0);
    for (let i = 0; i < 200; i++) sim.step(1000 + i * 50);
    const tracks = sim.animalTracksOf(1);
    expect(tracks.length).toBeGreaterThan(0);
    sim.placePlayer(2, { x: 0, y: 0, z: -32 }, 0);
    expect(sim.animalTracksOf(2)).toEqual(tracks);
    const animal = sim.snapshotFor(1).find((e) => (e.flags & SnapshotFlag.Animal) !== 0)!;
    sim.placeAnimal(animal.netId, { x: 200, y: 0, z: 200 });
    sim.step(12000);
    expect(sim.animalTracksOf(1).some((t) => t.x > 150)).toBe(false);
    sim.placePlayer(2, { x: 0, y: 0, z: -32 }, 0, 999);
    expect(sim.animalTracksOf(2)).toEqual([]);
  } finally {
    sim.dispose();
  }
});
