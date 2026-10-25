import { createWorld } from 'koota';
import { afterEach, expect, it } from 'vitest';
import { RaidDirector, type RaidFighter } from '../src/sim/raids';
import { ActionKind, beginAction, createActionState, type ActionState } from '../src/sim/actions';
import { createCollisionWorld } from '../src/collision/capsule';
import { createFlatTerrain } from '../src/world/terrain';
import { CROWNBREAKER_HOLD, HOLLOW_KING_SITE, KING_WARDS } from '../src/world/hollow-king';
import { SOUL_STORM } from '../src/data/world-boss';
import { kingStormSheltered, kingStormPhase, type KingStormView } from '../src/sim/king-storm';
import { encodeKingStorm, decodeServerMessage } from '../src/net/protocol';
const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach((fn) => fn()));
function arena() {
  const world = createWorld();
  cleanup.push(() => world.destroy());
  const fighters: (RaidFighter & {
    down: boolean;
    outdoors: boolean;
    position: { x: number; y: number; z: number };
  })[] = [];
  const hits: { id: number; damage: number; tick: number }[] = [];
  const director = new RaidDirector(
    world,
    1234,
    {
      collision: createCollisionWorld(createFlatTerrain(), [], 400),
      water: [],
      fighters: () => fighters,
      strikePlayer: (id, damage, tick) => hits.push({ id, damage, tick }),
      dropLoot: () => {},
    },
    { intervalMinSeconds: 1_000_000_000, encounterSites: [HOLLOW_KING_SITE] },
  );
  let tick = 0;
  function player(netId: number, x: number, z: number) {
    const p = {
      netId,
      rewardKey: `owner-${netId}`,
      position: { x, y: 0, z },
      aimYaw: Math.PI,
      action: createActionState(),
      outdoors: true,
      down: false,
    };
    fighters.push(p);
    return p;
  }
  const safe = player(1, KING_WARDS[0].x, KING_WARDS[0].z),
    exposed = player(2, CROWNBREAKER_HOLD.x, CROWNBREAKER_HOLD.z + 1);
  const outside = player(3, CROWNBREAKER_HOLD.x + 50, CROWNBREAKER_HOLD.z);
  const indoor = player(4, CROWNBREAKER_HOLD.x, CROWNBREAKER_HOLD.z);
  indoor.outdoors = false;
  const down = player(5, CROWNBREAKER_HOLD.x, CROWNBREAKER_HOLD.z);
  down.down = true;
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) director.step(++tick, false);
  };
  step(100);
  const id = director.raidersList().find((r) => r.kind === 'hollowKing')!.id;
  const record = (
    director as unknown as {
      raiders: Map<
        number,
        {
          action: ActionState;
          mode: string;
          damageTaken: number;
          stormWaves: number;
          stormRestUntilTick: number;
          attackRecovery: boolean;
        }
      >;
    }
  ).raiders.get(id)!;
  const hit = (power = 40000) => {
    director.placeRaider(id, { ...exposed.position, z: exposed.position.z + 1.5 }, 0);
    director.blowLands(2, exposed.position, Math.PI, { kind: 'swing', step: 1 }, 0, power);
  };
  const free = () => {
    beginAction(record.action, ActionKind.Idle);
    record.mode = 'circle';
  };
  const start = () => {
    free();
    hit();
    hits.length = 0;
    step();
    expect(director.kingStorm()?.phase).toBe('warning');
  };
  return {
    director,
    hits,
    safe,
    exposed,
    outside,
    indoor,
    down,
    step,
    record,
    hit,
    free,
    start,
    get tick() {
      return tick;
    },
  };
}
it('warns for seven seconds, then pulses only living, outdoor, exposed players and opens recovery', () => {
  const a = arena();
  a.start();
  expect(a.director.kingStorm()).toMatchObject({ wave: 1, remainingTicks: 140 });
  a.step(139);
  expect(a.hits).toEqual([]);
  a.step();
  expect(a.hits.map((h) => [h.id, h.damage])).toEqual([[2, 12]]);
  Object.assign(a.exposed.position, KING_WARDS[1]);
  a.step(20);
  expect(a.hits).toHaveLength(1);
  a.safe.position.x = CROWNBREAKER_HOLD.x;
  a.safe.position.z = CROWNBREAKER_HOLD.z;
  a.step(20);
  expect(a.hits.at(-1)?.id).toBe(1);
  a.step(60);
  expect(a.director.kingStorm()?.phase).toBe('recovery');
  expect(a.record.attackRecovery).toBe(true);
  a.step(76);
  expect(a.director.kingStorm()).toBeNull();
  expect(a.record.stormWaves).toBe(1);
});
it('does not interrupt an existing attack, limits the fight to two threshold waves and respects cooldown', () => {
  const a = arena();
  a.free();
  a.hit();
  beginAction(a.record.action, ActionKind.Swing, 1);
  a.step();
  expect(a.director.kingStorm()).toBeNull();
  a.free();
  a.step();
  expect(a.director.kingStorm()?.wave).toBe(1);
  a.step(316);
  a.record.damageTaken = 190;
  a.free();
  a.step(100);
  expect(a.director.kingStorm()).toBeNull();
  while (a.tick < a.record.stormRestUntilTick) {
    a.free();
    a.step();
  }
  a.free();
  a.step();
  expect(a.director.kingStorm()?.wave).toBe(2);
  a.step(316);
  a.free();
  a.step(300);
  expect(a.record.stormWaves).toBe(2);
  expect(a.director.kingStorm()).toBeNull();
});
it('clears a killing-blow storm immediately and resets threshold progress after a full wipe', () => {
  const killed = arena();
  killed.start();
  killed.hit(200000);
  expect(killed.director.kingStorm()).toBeNull();
  killed.hits.length = 0;
  killed.step(140);
  expect(killed.hits).toEqual([]);
  const wipe = arena();
  wipe.start();
  wipe.safe.down = true;
  wipe.exposed.down = true;
  wipe.step(101);
  expect(wipe.director.kingStorm()).toBeNull();
  expect(wipe.record.stormWaves).toBe(0);
  expect(wipe.record.damageTaken).toBe(0);
});
it('has exact shelter boundaries and bounded, strict binary phase messages', () => {
  const ward = KING_WARDS[0];
  expect(kingStormSheltered({ x: ward.x + SOUL_STORM.shelterRadius, z: ward.z })).toBe(true);
  expect(kingStormSheltered({ x: ward.x + SOUL_STORM.shelterRadius + 0.01, z: ward.z })).toBe(
    false,
  );
  expect(kingStormPhase(139)).toEqual({ phase: 'warning', remainingTicks: 1 });
  expect(kingStormPhase(140)).toEqual({ phase: 'storm', remainingTicks: 100 });
  expect(kingStormPhase(240)).toEqual({ phase: 'recovery', remainingTicks: 76 });
  expect(kingStormPhase(316)).toBeNull();
  const storm: KingStormView = {
    bossId: 20001,
    wave: 1,
    phase: 'warning',
    remainingTicks: 140,
    sheltered: true,
    outside: false,
  };
  const packet = encodeKingStorm(storm);
  expect(packet.byteLength).toBe(8);
  expect(new Uint8Array(packet)[0]).toBe(0x4c);
  expect(decodeServerMessage(packet)).toEqual({ type: 'kingStorm', storm });
  expect(decodeServerMessage(encodeKingStorm(null))).toEqual({ type: 'kingStorm', storm: null });
  const outside = { ...storm, sheltered: false, outside: true };
  expect(decodeServerMessage(encodeKingStorm(outside))).toEqual({
    type: 'kingStorm',
    storm: outside,
  });
  const badFlag = packet.slice(0);
  new DataView(badFlag).setUint8(7, 3);
  expect(decodeServerMessage(badFlag)).toBeNull();
  expect(decodeServerMessage(packet.slice(0, -1))).toBeNull();
  for (const bad of [
    { ...storm, phase: 'storm' as const, remainingTicks: 101 },
    { ...storm, wave: 3 },
    { ...storm, bossId: 0 },
  ])
    expect(decodeServerMessage(encodeKingStorm(bad))).toBeNull();
});

it('keeps the original countdown through a brief retreat instead of allowing warning restarts', () => {
  const a = arena();
  a.start();
  a.safe.position.x = CROWNBREAKER_HOLD.x + 50;
  a.safe.position.z = CROWNBREAKER_HOLD.z;
  a.exposed.position.x = CROWNBREAKER_HOLD.x + 50;
  a.exposed.position.z = CROWNBREAKER_HOLD.z;
  a.step(20);
  expect(a.director.kingStorm()).toMatchObject({ wave: 1, phase: 'warning', remainingTicks: 120 });
  Object.assign(a.safe.position, KING_WARDS[0]);
  a.exposed.position.x = CROWNBREAKER_HOLD.x;
  a.exposed.position.z = CROWNBREAKER_HOLD.z + 1;
  a.step(120);
  expect(a.director.kingStorm()?.phase).toBe('storm');
  expect(a.hits.map((h) => h.id)).toEqual([2]);
});
