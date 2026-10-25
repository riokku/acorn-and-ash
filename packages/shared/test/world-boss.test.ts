import { itemIndex } from '../src/data/items';
import { buildableKindIndex } from '../src/data/buildables';
import { characterStats } from '../src/data/equipment-stats';
import { pileFadesAtMs } from '../src/sim/dropping';
import { createWorld } from 'koota';
import { afterEach, expect, it } from 'vitest';
import { RaidDirector, type RaidFighter } from '../src/sim/raids';
import { createCollisionWorld } from '../src/collision/capsule';
import { createFlatTerrain, createWildernessTerrain } from '../src/world/terrain';
import { ActionKind, createActionState } from '../src/sim/actions';
import { HOLLOW_KING, hollowKingAttack, hollowKingToughness } from '../src/data/world-boss';
import { HOLLOW_KING_SITE, CROWNBREAKER_HOLD } from '../src/world/hollow-king';
import { encodeRaiderVitals, decodeServerMessage } from '../src/net/protocol';
import { DEFAULT_WORLD_SEED } from '../src/constants';

const dispose: (() => void)[] = [];
afterEach(() => dispose.splice(0).forEach((fn) => fn()));
function arena() {
  const world = createWorld();
  dispose.push(() => world.destroy());
  const fighters: (RaidFighter & {
    position: { x: number; y: number; z: number };
    down: boolean;
  })[] = [];
  const rewards: string[] = [];
  const hits: { id: number; damage: number }[] = [];
  let tick = 0,
    now = 1_000_000;
  const director = new RaidDirector(
    world,
    1234,
    {
      collision: createCollisionWorld(createFlatTerrain(), [], 400),
      water: [],
      nowMs: () => now,
      fighters: () => fighters,
      strikePlayer: (id, damage) => hits.push({ id, damage }),
      dropLoot: () => {},
      rewardWorldBoss: (key) => rewards.push(key),
    },
    { intervalMinSeconds: 1_000_000_000, encounterSites: [HOLLOW_KING_SITE] },
  );
  function player(id: number, dx = 0, dz = -3, key = `owner-${id}`) {
    const f = {
      netId: id,
      rewardKey: key,
      position: { x: 246 + dx, y: 0, z: 212 + dz },
      aimYaw: Math.PI,
      action: createActionState(),
      outdoors: true,
      down: false,
    };
    fighters.push(f);
    return f;
  }
  function step(n = 1) {
    for (let i = 0; i < n; i++) {
      now += 50;
      director.step(++tick, false);
    }
  }
  player(1, 0, -19);
  step(20);
  const id = director.raidersList().find((r) => r.kind === 'hollowKing')!.id;
  function hit(attacker = 1, power = 100) {
    const f = fighters.find((f) => f.netId === attacker)!;
    director.placeRaider(id, { x: f.position.x, y: 0, z: f.position.z + 1.5 }, 0);
    director.blowLands(attacker, f.position, Math.PI, { kind: 'swing', step: 1 }, 0, power);
  }
  return {
    director,
    id,
    fighters,
    rewards,
    hits,
    player,
    step,
    hit,
    setClock: (value: number) => {
      now = value;
    },
  };
}

it('has a long tell, dangerous second phase and a bounded prepared-group health budget', () => {
  expect([1, 3, 4, 5, 20].map(hollowKingToughness)).toEqual([220, 220, 230, 240, 240]);
  expect(hollowKingAttack(2, 1).strike).toBe(true);
  expect(hollowKingAttack(1, 0.5)).toEqual({ strike: true, swings: 3 });
  expect(HOLLOW_KING.chargeTicks).toBe(40);
  for (const health of [220, 230, 240])
    expect(decodeServerMessage(encodeRaiderVitals(1001, health))).toEqual({
      type: 'raiderVitals',
      id: 1001,
      maxHits: health,
    });
});
it('rises before fighting, shrugs off charged stunlock and exposes a real counter window', () => {
  const a = arena();
  a.hit();
  expect(a.director.raidersList()[0]!.hitsLeft).toBe(220); // still rising
  a.step(32);
  const record = (
    a.director as unknown as {
      raiders: Map<
        number,
        { damageTaken: number; attackRecovery: boolean; action: { kind: ActionKind } }
      >;
    }
  ).raiders.get(a.id)!;
  a.hit();
  expect(a.director.raidersList()[0]!.hitsLeft).toBe(220); // fractional armor damage
  expect(record.damageTaken).toBeCloseTo(0.22);
  a.director.blowLands(1, a.fighters[0]!.position, Math.PI, { kind: 'strike' }, 0, 100);
  expect(record.action.kind).not.toBe(ActionKind.Flinch);
  for (let i = 0; i < 500 && !record.attackRecovery; i++) {
    a.director.placeRaider(a.id, { x: 246, y: 0, z: 196 }, 0);
    a.step();
  }
  expect(record.attackRecovery).toBe(true);
  const before = record.damageTaken;
  a.hit();
  expect(record.damageTaken - before).toBeCloseTo(0.65);
});
it('credits recent distinct owners, persists the real-time rest deadline and excludes spectators', () => {
  const a = arena();
  a.step(100);
  a.player(2, 0, -19);
  a.player(3, 0, -19, 'owner-1');
  a.player(4, 0, -19);
  a.hit(1);
  a.hit(2);
  a.hit(3);
  a.hit(1, 200_000);
  expect(a.rewards.sort()).toEqual(['owner-1', 'owner-2']);
  const deadline = a.director.worldBossRestUntilMs();
  expect(deadline).toBeGreaterThan(1_800_000);
  a.step(100);
  expect(a.director.drainNews().find((news) => news.kind === 'encounterCleared')).toMatchObject({
    x: CROWNBREAKER_HOLD.x,
    z: CROWNBREAKER_HOLD.z,
  });
  expect(a.director.raidersList()).toEqual([]);
  a.director.restoreWorldBossRestUntilMs(deadline);
  a.setClock(deadline - 2000);
  a.step(20);
  expect(a.director.raidersList()).toEqual([]);
  a.setClock(deadline);
  a.step(20);
  expect(a.director.raidersList()[0]!.kind).toBe('hollowKing');
});
it('resets damage after a full wipe without imposing the defeat cooldown', () => {
  const a = arena();
  a.step(100);
  a.hit(1, 1000);
  expect(a.director.raidersList()[0]!.hitsLeft).toBeLessThan(220);
  a.fighters[0]!.down = true;
  a.step(120);
  expect(a.director.raidersList()[0]!.hitsLeft).toBe(220);
  expect(a.director.worldBossRestUntilMs()).toBe(0);
  expect(a.rewards).toEqual([]);
});
it('clears and levels an arena without changing the far world edge', () => {
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
  const c = CROWNBREAKER_HOLD;
  const center = terrain.heightAt(c.x, c.z);
  for (const [dx, dz] of [
    [0, 15],
    [15, 0],
    [-15, 0],
    [0, -15],
  ])
    expect(terrain.heightAt(c.x + dx!, c.z + dz!)).toBeCloseTo(center, 3);
  expect(Number.isFinite(terrain.heightAt(300, 300))).toBe(true);
});

it('cleaves a group in front, warns for two seconds before a full-circle strike, and hits each player once per spin', () => {
  const a = arena();
  const front = a.fighters[0]!;
  front.position = { x: 246, y: 0, z: 208 };
  const flank = a.player(2, 2, -4),
    rear = a.player(3, 0, 4),
    far = a.player(4, 0, 12);
  let longestCharge = 0,
    sawSpin = false;
  const action = createActionState();
  for (let i = 0; i < 1000; i++) {
    a.director.placeRaider(a.id, { x: 246, y: 0, z: 212 }, 0);
    a.step();
    const state = a.director.actionOf(a.id);
    if (!state) continue;
    Object.assign(action, state);
    if (action.kind === ActionKind.Charge) longestCharge = Math.max(longestCharge, state.age);
    if (action.kind === ActionKind.Strike) sawSpin = true;
    if (sawSpin && action.kind === ActionKind.Idle) {
      a.step(10);
      break;
    }
  }
  expect(longestCharge).toBeGreaterThanOrEqual(HOLLOW_KING.chargeTicks - 1);
  expect(sawSpin).toBe(true);
  expect(a.hits.filter((h) => h.id === front.netId).length).toBeGreaterThan(1);
  expect(a.hits.some((h) => h.id === flank.netId)).toBe(true);
  expect(a.hits.filter((h) => h.id === rear.netId)).toHaveLength(1);
  expect(a.hits.some((h) => h.id === far.netId)).toBe(false);
});

it('appends reward IDs, equips the protective crown and preserves an owner’s uncollected relic', () => {
  expect(itemIndex('kingCrown')).toBe(58);
  expect(itemIndex('firstBellRelic')).toBe(59);
  expect(buildableKindIndex('firstBellRelic')).toBe(23);
  const stats = characterStats({ helm: 'kingCrown' });
  expect(stats.protection).toBe(12);
  expect(stats.warmth).toBe(20);
  expect(
    pileFadesAtMs({
      id: 1,
      item: 'firstBellRelic',
      count: 1,
      x: 246,
      z: 212,
      droppedAtMs: 1000,
      ownerKey: 'hero',
    }),
  ).toBe(Infinity);
  expect(
    Number.isFinite(
      pileFadesAtMs({ id: 2, item: 'firstBellRelic', count: 1, x: 246, z: 212, droppedAtMs: 1000 }),
    ),
  ).toBe(true);
});
