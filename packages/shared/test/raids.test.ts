import { createWorld, type World } from 'koota';
import { afterEach, describe, expect, it } from 'vitest';

import { HEALTH_MAX, TICK_HZ, TICK_MILLISECONDS, TICK_SECONDS } from '../src/constants';
import { createCollisionWorld } from '../src/collision/capsule';
import { LIGHT_COMBO, RISE, STRIKE, WINDUP_TICKS } from '../src/data/moves';
import { RAID, RAIDER_KINDS, type RaiderKindId } from '../src/data/raiders';
import { Facing, RaiderTag } from '../src/ecs/traits';
import { createRng } from '../src/rng';
import {
  ActionKind,
  RiseFrom,
  beginAction,
  createActionState,
  type ActionState,
  type Impact,
} from '../src/sim/actions';
import { addItem } from '../src/sim/inventory';
import { PlayerButton, createInput } from '../src/sim/player';
import {
  BLOW_SETTLE_TICKS,
  RaidDirector,
  drawGroupSize,
  drawLineup,
  isFacing,
  type RaidFighter,
} from '../src/sim/raids';
import { SnapshotFlag, WorldSimulation } from '../src/sim/world-sim';
import { createFlatTerrain } from '../src/world/terrain';
import { overlapsWater, type WaterCircle } from '../src/world/water';

const SWING_1: Impact = { kind: 'swing', step: 1 };
const FINISHER: Impact = { kind: 'swing', step: 3 };
const STRIKE_BLOW: Impact = { kind: 'strike' };
const ATTACKING: ReadonlySet<number> = new Set([
  ActionKind.Windup,
  ActionKind.Swing,
  ActionKind.Charge,
  ActionKind.Strike,
]);

/** A player as a raid sees them, that a test can move about at will. */
interface TestFighter extends RaidFighter {
  position: { x: number; y: number; z: number };
  aimYaw: number;
  action: ActionState;
  outdoors: boolean;
  down: boolean;
}

interface ArenaOptions {
  readonly seed?: number;
  readonly intervalMinSeconds?: number;
  readonly water?: readonly WaterCircle[];
  readonly boundsHalfExtent?: number;
}

const worlds: World[] = [];

afterEach(() => {
  for (const world of worlds.splice(0)) world.destroy();
});

/**
 * A flat, empty patch of ground with a raid director on it, and nothing
 * else: the players are plain records a test moves by hand, and whatever a
 * raid does to them is written down rather than done.
 */
function arena(options: ArenaOptions = {}) {
  const world = createWorld();
  worlds.push(world);
  const fighters: TestFighter[] = [];
  const strikes: { netId: number; damage: number; impactTick: number; atTick: number }[] = [];
  const loot: { item: string; count: number; x: number; z: number }[] = [];
  let tick = 0;
  const director = new RaidDirector(
    world,
    options.seed ?? 1234,
    {
      collision: createCollisionWorld(createFlatTerrain(), [], options.boundsHalfExtent ?? 200),
      water: options.water ?? [],
      fighters: () => fighters,
      strikePlayer: (netId, damage, impactTick) =>
        strikes.push({ netId, damage, impactTick, atTick: tick }),
      dropLoot: (item, count, position) => loot.push({ item, count, x: position.x, z: position.z }),
    },
    { intervalMinSeconds: options.intervalMinSeconds ?? 600 },
  );

  const addFighter = (netId: number, x = 0, z = 0): TestFighter => {
    const fighter: TestFighter = {
      netId,
      position: { x, y: 0, z },
      aimYaw: 0,
      action: createActionState(),
      outdoors: true,
      down: false,
    };
    fighters.push(fighter);
    return fighter;
  };

  const step = (ticks = 1, night = false, each?: () => void): void => {
    for (let i = 0; i < ticks; i++) {
      tick += 1;
      director.step(tick, night);
      each?.();
    }
  };

  /** Put a raider right in front of a fighter, facing them, this far off. */
  const inFrontOf = (fighter: TestFighter, raiderId: number, distance = 1.5): void => {
    const x = fighter.position.x - Math.sin(fighter.aimYaw) * distance;
    const z = fighter.position.z - Math.cos(fighter.aimYaw) * distance;
    director.placeRaider(raiderId, { x, y: 0, z }, fighter.aimYaw + Math.PI);
  };

  return {
    director,
    world,
    fighters,
    strikes,
    loot,
    addFighter,
    step,
    inFrontOf,
    /** Hand the world back early: Koota only allows a few at once. */
    release: (): void => {
      worlds.splice(worlds.indexOf(world), 1);
      world.destroy();
    },
    get tick() {
      return tick;
    },
  };
}

/** Start a raid of exactly these raiders on a fighter, and say who they are. */
function raidOn(
  scene: ReturnType<typeof arena>,
  netId: number,
  kinds: readonly RaiderKindId[],
): { raidId: number; raiderIds: number[] } {
  const raidId = scene.director.startRaid(netId, kinds);
  if (raidId === null) throw new Error('the raid had nowhere to turn up');
  return { raidId, raiderIds: scene.director.raidersOf(raidId) };
}

function only<T>(list: readonly T[]): T {
  expect(list).toHaveLength(1);
  const first = list[0];
  if (first === undefined) throw new Error('empty');
  return first;
}

/** A raider's move, to tamper with: tests only. */
function actionOf(scene: ReturnType<typeof arena>, raiderId: number): ActionState {
  const action = scene.director.actionOf(raiderId);
  if (action === null) throw new Error('no such raider');
  return action as ActionState;
}

function distanceBetween(
  a: { readonly x: number; readonly z: number },
  b: { readonly x: number; readonly z: number },
): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

const seconds = (s: number): number => Math.round(s * TICK_HZ);

describe('when a raid comes', () => {
  it('comes after a spell outdoors, and not before', () => {
    const scene = arena({ intervalMinSeconds: 10 });
    scene.addFighter(1);
    scene.step(seconds(10) - 1);
    expect(scene.director.raidIds()).toEqual([]);

    scene.step(seconds(5) + 1);
    expect(scene.director.raidIds()).toHaveLength(1);
    const news = only(scene.director.drainNews());
    expect(news).toMatchObject({ kind: 'incoming', targetNetId: 1 });
    expect(news.count).toBeGreaterThanOrEqual(1);
    expect(news.count).toBeLessThanOrEqual(3);
  });

  it('comes twice as quickly at night', () => {
    const day = arena({ intervalMinSeconds: 100 });
    const night = arena({ intervalMinSeconds: 100 });
    day.addFighter(1);
    night.addFighter(1);
    day.step(21, false);
    night.step(21, true);
    const dayLeft = day.director.countdownOf(1) ?? 0;
    const nightLeft = night.director.countdownOf(1) ?? 0;
    // The same seed draws the same wait; night just eats through it twice as fast.
    expect(dayLeft - nightLeft).toBeCloseTo(21 * TICK_SECONDS, 5);
  });

  it('never counts down for somebody indoors, or knocked out', () => {
    const scene = arena({ intervalMinSeconds: 5 });
    const indoors = scene.addFighter(1);
    indoors.outdoors = false;
    const down = scene.addFighter(2, 10, 0);
    down.down = true;
    scene.step(seconds(20));
    expect(scene.director.raidIds()).toEqual([]);
    expect(scene.director.countdownOf(1)).toBeNull();
    expect(scene.director.countdownOf(2)).toBeNull();
  });

  it('sends one raid at a time after any one player', () => {
    const scene = arena({ intervalMinSeconds: 1 });
    scene.addFighter(1);
    raidOn(scene, 1, ['minion']);
    scene.step(seconds(10));
    expect(scene.director.raidIds()).toHaveLength(1);
    expect(scene.director.countdownOf(1)).toBeNull();
  });

  it('holds off a raid on somebody standing right by another one', () => {
    const scene = arena({ intervalMinSeconds: 1 });
    scene.addFighter(1);
    scene.addFighter(2, 1, 0);
    raidOn(scene, 1, ['minion']);
    scene.step(seconds(2));
    expect(scene.director.raidIds()).toHaveLength(1);
    expect(scene.director.countdownOf(2)).toBeGreaterThan(RAID.postponeSeconds - 2);
  });

  it('brings one to three at a time, more of them at night', () => {
    const rng = createRng(99);
    let daySum = 0;
    let nightSum = 0;
    for (let i = 0; i < 2000; i++) {
      const day = drawGroupSize(rng, false);
      const night = drawGroupSize(rng, true);
      for (const size of [day, night]) {
        expect(size).toBeGreaterThanOrEqual(1);
        expect(size).toBeLessThanOrEqual(3);
      }
      daySum += day;
      nightSum += night;
    }
    expect(nightSum).toBeGreaterThan(daySum * 1.2);
  });

  it('never brings two warriors', () => {
    const rng = createRng(7);
    const seen = new Set<RaiderKindId>();
    for (let i = 0; i < 500; i++) {
      const lineup = drawLineup(rng, 3);
      expect(lineup.filter((kind) => kind === 'warrior').length).toBeLessThanOrEqual(1);
      for (const kind of lineup) seen.add(kind);
    }
    expect([...seen].sort()).toEqual(['mage', 'minion', 'rogue', 'warrior']);
  });
});

describe('a raid turning up', () => {
  it('climbs out of the ground a good way off, facing the player', () => {
    const scene = arena();
    const player = scene.addFighter(1);
    const { raiderIds } = raidOn(scene, 1, ['minion', 'rogue', 'warrior']);
    expect(raiderIds).toHaveLength(3);
    expect(scene.world.query(RaiderTag)).toHaveLength(3);

    for (const id of raiderIds) {
      const position = scene.director.positionOf(id);
      if (position === null) throw new Error('missing raider');
      const distance = distanceBetween(position, player.position);
      expect(distance).toBeGreaterThan(RAID.spawnDistance.min - 3);
      expect(distance).toBeLessThan(RAID.spawnDistance.max + 3);
      expect(scene.director.actionOf(id)).toMatchObject({
        kind: ActionKind.Rise,
        step: RiseFrom.Ground,
      });
    }
    expect(scene.director.raidersList().map((raider) => raider.hitsLeft)).toEqual([
      RAIDER_KINDS.minion.toughness,
      RAIDER_KINDS.rogue.toughness,
      RAIDER_KINDS.warrior.toughness,
    ]);
    expect(scene.director.drainListChanged()).toBe(true);
    expect(scene.director.drainListChanged()).toBe(false);
  });

  it('stays put while it climbs out, then comes on', () => {
    const scene = arena();
    const player = scene.addFighter(1);
    const { raiderIds } = raidOn(scene, 1, ['minion']);
    const id = only(raiderIds);
    const start = { ...(scene.director.positionOf(id) ?? { x: 0, z: 0 }) };
    scene.step(RISE.ground - 1);
    expect(distanceBetween(scene.director.positionOf(id) ?? start, start)).toBeLessThan(0.01);
    scene.step(seconds(3));
    const now = scene.director.positionOf(id) ?? start;
    expect(distanceBetween(now, player.position)).toBeLessThan(
      distanceBetween(start, player.position) - 5,
    );
  });

  it('does not come for somebody indoors', () => {
    const scene = arena();
    scene.addFighter(1).outdoors = false;
    expect(scene.director.startRaid(1, ['minion'])).toBeNull();
  });

  it('never turns up in the water or outside the world', () => {
    const water: WaterCircle[] = [{ x: 35, z: 0, radius: 15 }];
    for (let seed = 1; seed <= 25; seed++) {
      const scene = arena({ seed, water, boundsHalfExtent: 60 });
      scene.addFighter(1, 20, 20);
      const { raiderIds } = raidOn(scene, 1, ['minion', 'rogue', 'mage']);
      for (const id of raiderIds) {
        const position = scene.director.positionOf(id);
        if (position === null) throw new Error('missing raider');
        expect(Math.abs(position.x)).toBeLessThanOrEqual(60);
        expect(Math.abs(position.z)).toBeLessThanOrEqual(60);
        expect(overlapsWater(water, position.x, position.z, 0)).toBe(false);
      }
      scene.release();
    }
  });
});

describe('a fight', () => {
  it('comes at the player one attacker at a time, every light attack wound up first', () => {
    const scene = arena();
    scene.addFighter(1);
    const { raiderIds } = raidOn(scene, 1, ['minion', 'rogue', 'warrior']);
    const previous = new Map<number, number>();
    const attacked = new Set<number>();
    scene.step(seconds(60), false, () => {
      let attacking = 0;
      for (const id of raiderIds) {
        const action = scene.director.actionOf(id);
        if (action === null) continue;
        if (ATTACKING.has(action.kind)) {
          attacking += 1;
          attacked.add(id);
        }
        if (action.kind === ActionKind.Swing && action.step === 1 && action.age === 0) {
          // A combo only ever opens from a wind-up the player can see coming.
          expect(previous.get(id)).toBe(ActionKind.Windup);
        }
        previous.set(id, action.kind);
      }
      expect(attacking).toBeLessThanOrEqual(1);
    });
    // Everybody got their turn, the slow warrior too.
    expect([...attacked].sort()).toEqual([...raiderIds].sort());
    expect(scene.strikes.length).toBeGreaterThan(3);
  });

  it('lands each blow a moment after it falls, for a roll to have the chance to beat it', () => {
    const scene = arena();
    scene.addFighter(1);
    raidOn(scene, 1, ['minion']);
    scene.step(seconds(40));
    expect(scene.strikes.length).toBeGreaterThan(0);
    for (const strike of scene.strikes) {
      expect(strike.atTick - strike.impactTick).toBe(BLOW_SETTLE_TICKS);
      expect([
        RAIDER_KINDS.minion.swingDamage,
        Math.round(RAIDER_KINDS.minion.swingDamage * 1.5),
        RAIDER_KINDS.minion.strikeDamage,
      ]).toContain(strike.damage);
    }
  });

  it('misses a player who steps out of reach before the blow lands', () => {
    /** Play the same raid twice, once stepping well clear the moment the first blow falls. */
    const play = (sidestep: boolean) => {
      const scene = arena();
      const player = scene.addFighter(1);
      const id = only(raidOn(scene, 1, ['minion']).raiderIds);
      let fellAt = -1;
      scene.step(seconds(40), false, () => {
        const action = scene.director.actionOf(id);
        if (fellAt >= 0 || action === null) return;
        if (action.kind === ActionKind.Swing && action.age === LIGHT_COMBO[0].impact) {
          fellAt = scene.tick;
          if (sidestep) player.position.x += 6;
        }
      });
      return { fellAt, landed: scene.strikes.some((strike) => strike.impactTick === fellAt) };
    };
    const stood = play(false);
    const stepped = play(true);
    expect(stood.fellAt).toBeGreaterThan(0);
    expect(stepped.fellAt).toBe(stood.fellAt);
    expect(stood.landed).toBe(true);
    expect(stepped.landed).toBe(false);
  });
});

describe("a player's blows on a raider", () => {
  /** One raider of this kind, done climbing out, right in front of the player. */
  function standoff(kind: RaiderKindId, seed = 1234) {
    const scene = arena({ seed });
    const player = scene.addFighter(1);
    const id = only(raidOn(scene, 1, [kind]).raiderIds);
    scene.step(RISE.ground + 1);
    scene.inFrontOf(player, id);
    scene.director.drainHits();
    scene.director.drainListChanged();
    return { scene, player, id };
  }

  const hit = (scene: ReturnType<typeof arena>, player: TestFighter, impact: Impact): boolean =>
    scene.director.blowLands(1, player.position, player.aimYaw, impact, 0);

  it('counts a light swing as one, the finisher as two and a strike as four', () => {
    const { scene, player, id } = standoff('warrior');
    expect(hit(scene, player, SWING_1)).toBe(true);
    expect(only(scene.director.drainHits())).toMatchObject({ raiderId: id, hitsLeft: 6, netId: 1 });
    scene.step(30);
    scene.inFrontOf(player, id);
    hit(scene, player, FINISHER);
    expect(only(scene.director.drainHits())).toMatchObject({ hitsLeft: 4, heavy: true });
    scene.step(30);
    scene.inFrontOf(player, id);
    hit(scene, player, STRIKE_BLOW);
    expect(only(scene.director.drainHits())).toMatchObject({ hitsLeft: 0, heavy: true });
    expect(scene.director.drainListChanged()).toBe(true);
  });

  it('misses a raider standing behind the player', () => {
    const { scene, player, id } = standoff('minion');
    scene.director.placeRaider(id, { x: 0, y: 0, z: 1.5 });
    expect(hit(scene, player, SWING_1)).toBe(false);
    expect(scene.director.drainHits()).toEqual([]);
  });

  it('staggers it, but not again straight away', () => {
    const { scene, player, id } = standoff('minion');
    hit(scene, player, SWING_1);
    expect(only(scene.director.drainHits()).shrugged).toBe(false);
    expect(actionOf(scene, id).kind).toBe(ActionKind.Flinch);

    scene.step(2);
    scene.inFrontOf(player, id);
    hit(scene, player, SWING_1);
    expect(only(scene.director.drainHits())).toMatchObject({ shrugged: true, hitsLeft: 2 });
    // Still in the first flinch, not started over.
    expect(actionOf(scene, id).age).toBeGreaterThan(0);
  });

  it('always staggers on a heavy blow', () => {
    const { scene, player, id } = standoff('warrior');
    hit(scene, player, SWING_1);
    scene.director.drainHits();
    scene.step(2);
    scene.inFrontOf(player, id);
    hit(scene, player, FINISHER);
    expect(only(scene.director.drainHits()).shrugged).toBe(false);
    expect(actionOf(scene, id)).toMatchObject({ kind: ActionKind.Flinch, age: 0 });
  });

  it('lets a warrior shrug off a light swing mid-attack, but not a charged strike', () => {
    const { scene, player, id } = standoff('warrior');
    beginAction(actionOf(scene, id), ActionKind.Windup, RAIDER_KINDS.warrior.windup);
    hit(scene, player, SWING_1);
    expect(only(scene.director.drainHits())).toMatchObject({ shrugged: true, hitsLeft: 6 });
    expect(actionOf(scene, id).kind).toBe(ActionKind.Windup);

    hit(scene, player, STRIKE_BLOW);
    expect(only(scene.director.drainHits())).toMatchObject({ shrugged: false, hitsLeft: 2 });
    expect(actionOf(scene, id).kind).toBe(ActionKind.Flinch);
  });

  it('cannot touch a raider mid-roll, unless the roll only just began', () => {
    const { scene, player, id } = standoff('rogue');
    const action = actionOf(scene, id);
    beginAction(action, ActionKind.Dodge);
    action.age = 4;
    expect(hit(scene, player, SWING_1)).toBe(true);
    expect(scene.director.drainHits()).toEqual([]);

    beginAction(action, ActionKind.Dodge);
    action.age = 1;
    hit(scene, player, SWING_1);
    expect(scene.director.drainHits()).toHaveLength(1);
  });

  it('sees a swing coming and sometimes rolls clear - a rogue far more often than a warrior', () => {
    const rolls = (kind: RaiderKindId, aimedAway = false): number => {
      let count = 0;
      for (let seed = 1; seed <= 40; seed++) {
        const { scene, player, id } = standoff(kind, seed);
        scene.inFrontOf(player, id, 2.5);
        if (aimedAway) player.aimYaw = Math.PI;
        beginAction(player.action, ActionKind.Swing, 1);
        scene.step(1);
        if (actionOf(scene, id).kind === ActionKind.Dodge) count += 1;
        scene.release();
      }
      return count;
    };
    const rogue = rolls('rogue');
    const warrior = rolls('warrior');
    expect(rogue).toBeGreaterThan(10);
    expect(rogue).toBeLessThan(32);
    expect(warrior).toBeLessThan(rogue / 2);
    expect(rolls('rogue', true)).toBe(0);
  });

  it('is knocked back, and turns to face whoever hit it', () => {
    const { scene, player, id } = standoff('minion');
    scene.director.placeRaider(id, { x: 0, y: 0, z: -1.5 }, 2);
    hit(scene, player, SWING_1);
    scene.step(8);
    const position = scene.director.positionOf(id);
    const entity = scene.world.query(RaiderTag)[0];
    if (position === null || entity === undefined) throw new Error('missing raider');
    expect(position.z).toBeLessThan(-1.7);
    // Back toward the player at the origin, down +Z.
    expect(isFacing(entity.get(Facing)?.yaw ?? 0, Math.PI)).toBe(true);
  });
});

describe('the end of a raid', () => {
  it('leaves a bone where a beaten raider falls apart, and calls the raid fought off', () => {
    const scene = arena();
    const player = scene.addFighter(1);
    const { raidId, raiderIds } = raidOn(scene, 1, ['minion']);
    const id = only(raiderIds);
    scene.director.drainNews();
    scene.step(RISE.ground + 1);
    scene.inFrontOf(player, id);
    scene.director.blowLands(1, player.position, player.aimYaw, STRIKE_BLOW, 0);
    expect(actionOf(scene, id).kind).toBe(ActionKind.KnockedOut);
    // Down, and no longer anything to swing at.
    expect(scene.director.raiderInReachOf(player.position, player.aimYaw)).toBeNull();

    scene.step(seconds(RAID.crumbleSeconds) - 1);
    expect(scene.loot).toEqual([]);
    scene.step(1);
    expect(only(scene.loot)).toMatchObject({ item: 'bone', count: 1 });
    expect(scene.director.raidersList()).toEqual([]);
    expect(scene.world.query(RaiderTag)).toHaveLength(0);
    expect(only(scene.director.drainNews())).toMatchObject({
      kind: 'foughtOff',
      raidId,
      targetNetId: 1,
      count: 1,
    });
  });

  it('gets two bones from a warrior', () => {
    const scene = arena();
    const player = scene.addFighter(1);
    const id = only(raidOn(scene, 1, ['warrior']).raiderIds);
    scene.step(RISE.ground + 1);
    for (let i = 0; i < 2; i++) {
      scene.inFrontOf(player, id);
      scene.director.blowLands(1, player.position, player.aimYaw, STRIKE_BLOW, 0);
    }
    scene.step(seconds(RAID.crumbleSeconds));
    expect(only(scene.loot)).toMatchObject({ item: 'bone', count: 2 });
  });

  it('waits outside for somebody who went indoors, by where they went in, then gives up', () => {
    const scene = arena();
    const player = scene.addFighter(1);
    const { raiderIds } = raidOn(scene, 1, ['minion', 'rogue']);
    scene.director.drainNews();
    scene.step(seconds(14));
    player.outdoors = false;
    // Indoors, where they are is a room's own coordinates: meaningless out here.
    player.position.x = 500;

    scene.step(seconds(RAID.indoorPatienceSeconds) - 2);
    expect(scene.director.raidersList()).toHaveLength(2);
    for (const id of raiderIds) {
      const position = scene.director.positionOf(id);
      if (position === null) throw new Error('missing raider');
      expect(Math.hypot(position.x, position.z)).toBeLessThan(RAID.standoff + 3);
    }
    expect(scene.strikes.filter((strike) => strike.atTick > scene.tick - 30)).toEqual([]);

    scene.step(seconds(RAID.leaveSeconds) + 4);
    expect(scene.director.raidersList()).toEqual([]);
    expect(only(scene.director.drainNews())).toMatchObject({ kind: 'gaveUp', count: 0 });
    expect(scene.loot).toEqual([]);
  });

  it('walks off once the player it came for is knocked out', () => {
    const scene = arena();
    const player = scene.addFighter(1);
    raidOn(scene, 1, ['minion']);
    scene.director.drainNews();
    scene.step(seconds(12));
    player.down = true;
    scene.step(seconds(RAID.leaveSeconds) + 2);
    expect(scene.director.raidersList()).toEqual([]);
    expect(only(scene.director.drainNews()).kind).toBe('gaveUp');
  });

  it('keeps walking off even if hit on the way', () => {
    const scene = arena();
    const player = scene.addFighter(1);
    const id = only(raidOn(scene, 1, ['warrior']).raiderIds);
    scene.step(RISE.ground + 1);
    player.down = true;
    scene.step(2);
    player.down = false;
    scene.inFrontOf(player, id);
    scene.director.blowLands(1, player.position, player.aimYaw, SWING_1, 0);
    scene.step(seconds(RAID.leaveSeconds));
    expect(scene.director.raidersList()).toEqual([]);
  });

  it('lets go of somebody who leaves the world', () => {
    const scene = arena();
    scene.addFighter(1);
    raidOn(scene, 1, ['minion']);
    scene.director.drainNews();
    scene.step(seconds(5));
    scene.fighters.length = 0;
    scene.director.forgetPlayer(1);
    scene.step(seconds(RAID.leaveSeconds) + 1);
    expect(scene.director.raidersList()).toEqual([]);
    expect(only(scene.director.drainNews()).kind).toBe('gaveUp');
  });

  it('lets go of somebody who simply outruns them', () => {
    const scene = arena();
    const player = scene.addFighter(1);
    raidOn(scene, 1, ['minion']);
    scene.director.drainNews();
    scene.step(seconds(2));
    player.position.x = 150;
    player.position.z = 150;
    scene.step(seconds(RAID.loseTrackSeconds + RAID.leaveSeconds) + 4);
    expect(scene.director.raidersList()).toEqual([]);
    expect(only(scene.director.drainNews()).kind).toBe('gaveUp');
  });
});

describe('a raid, played twice', () => {
  it('goes exactly the same way from the same seed', () => {
    const play = (): string => {
      const scene = arena({ seed: 77, intervalMinSeconds: 3 });
      scene.addFighter(1);
      scene.step(seconds(30));
      return (
        JSON.stringify(
          scene.director.raidersList().map((raider) => ({
            ...raider,
            at: scene.director.positionOf(raider.id),
          })),
        ) + JSON.stringify(scene.strikes)
      );
    };
    expect(play()).toBe(play());
  });
});

describe('raids in the world', () => {
  let clockMs = 1_700_000_000_000;
  const built: WorldSimulation[] = [];
  afterEach(() => {
    for (const sim of built.splice(0)) sim.dispose();
  });

  function world(): WorldSimulation {
    const sim = new WorldSimulation({ seed: 1234 });
    built.push(sim);
    sim.addPlayer(1);
    return sim;
  }

  /** Step until something comes true, feeding the player an input each tick. */
  function until(
    sim: WorldSimulation,
    done: () => boolean,
    input: (seq: number) => ReturnType<typeof createInput> = (seq) => createInput(seq),
    limit = seconds(90),
  ): void {
    for (let seq = 1; seq <= limit; seq++) {
      sim.queueInput(1, input(seq));
      sim.step((clockMs += TICK_MILLISECONDS));
      if (done()) return;
    }
    throw new Error('it never happened');
  }

  it("lets a raider's blow take health off the player", () => {
    const sim = world();
    sim.startRaid(1, ['minion']);
    const events: ReturnType<WorldSimulation['drainHealthEvents']> = [];
    until(sim, () => {
      events.push(...sim.drainHealthEvents());
      return events.length > 0;
    });
    const first = only(events);
    expect(first.dodged).toBe(false);
    expect(first.health).toBeLessThan(HEALTH_MAX);
  });

  it('lets a roll begun as the blow falls beat it', () => {
    const sim = world();
    const id = only(sim.raids.raidersOf(sim.startRaid(1, ['minion']) ?? -1));
    const events: ReturnType<WorldSimulation['drainHealthEvents']> = [];
    let rolled = false;
    until(
      sim,
      () => {
        events.push(...sim.drainHealthEvents());
        return events.length > 0;
      },
      (seq) => {
        const action = sim.raids.actionOf(id);
        // Roll the tick before the blow falls, a swing or a charged strike.
        const falling =
          action?.kind === ActionKind.Swing
            ? action.age === (LIGHT_COMBO[action.step - 1]?.impact ?? 0) - 1
            : action?.kind === ActionKind.Strike && action.age === STRIKE.impact - 1;
        const now = !rolled && falling;
        if (now) rolled = true;
        return createInput(seq, 0, 0, 0, now ? PlayerButton.Dodge : 0);
      },
    );
    expect(rolled).toBe(true);
    expect(events[0]).toMatchObject({ dodged: true, health: HEALTH_MAX });
  });

  it('gives up on somebody it knocked out', () => {
    const sim = world();
    sim.startRaid(1, ['minion', 'rogue']);
    let knockedOut = false;
    until(
      sim,
      () => {
        if (sim.drainHealthEvents().some((event) => event.knockedOut)) knockedOut = true;
        return sim.drainRaidNews().some((news) => news.kind === 'gaveUp');
      },
      undefined,
      seconds(150),
    );
    expect(knockedOut).toBe(true);
  });

  it("lands the player's own swing on a raider, and tells everybody", () => {
    const sim = world();
    addItem(sim.inventoryOf(1), 'axe');
    sim.useItem(1, 'axe');
    const id = only(sim.raids.raidersOf(sim.startRaid(1, ['minion']) ?? -1));
    const me = sim.readPlayer(1)?.position;
    if (me === undefined) throw new Error('missing player');
    // Aimed straight down -Z, with the raider still climbing out right there.
    sim.raids.placeRaider(id, { x: me.x, y: me.y, z: me.z - 1.5 });
    sim.drainRaiderHits();
    sim.drainRaidersChanged();
    let swung = false;
    until(
      sim,
      () => sim.drainRaiderHits().length > 0,
      (seq) => {
        const buttons = swung ? 0 : PlayerButton.Swing;
        swung = true;
        return createInput(seq, 0, 0, 0, buttons, 0);
      },
      20,
    );
    expect(sim.raidersList()).toEqual([
      { id, kind: 'minion', hitsLeft: RAIDER_KINDS.minion.toughness - 1 },
    ]);
    expect(sim.drainRaidersChanged()).toBe(true);
  });

  it('shows raiders in the snapshot of somebody outdoors', () => {
    const sim = world();
    const id = only(sim.raids.raidersOf(sim.startRaid(1, ['mage']) ?? -1));
    sim.step((clockMs += TICK_MILLISECONDS));
    const entry = sim.snapshotFor(1).find((entity) => entity.netId === id);
    expect(entry).toBeDefined();
    expect((entry?.flags ?? 0) & SnapshotFlag.Raider).toBe(SnapshotFlag.Raider);
  });

  it('opens every light attack with a wind-up you can see coming', () => {
    expect(Math.min(...WINDUP_TICKS)).toBeGreaterThanOrEqual(6);
    for (const kind of Object.values(RAIDER_KINDS)) {
      // And every raider is slower than a sprinting player, so running away works.
      expect(kind.runSpeed).toBeLessThan(7);
    }
    expect(isFacing(0.1, 0)).toBe(true);
    expect(isFacing(Math.PI, 0)).toBe(false);
  });
});
