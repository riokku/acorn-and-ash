import * as THREE from 'three/webgpu';
import {
  createRng,
  hashSeed,
  isOnLake,
  isOnWater,
  LAKE,
  POND_LEVEL,
  type WaterCircle,
} from '@acorn/shared';

import { polyforkAnimal, type AnimatedAnimal } from './polyfork-animal';

/**
 * Scenery wildlife (decision 0280): ducks on the water, frogs at its edge,
 * crows on the open ground round the clearing and owls in the deep woods,
 * mostly by night. They are only scenery: nobody can hunt them, they drop
 * nothing, and they scatter when someone comes close. So each player's own
 * game draws them, from the world's seed, the way it draws the fireflies,
 * and the server never hears of them.
 */
export type SceneryKind = 'duck' | 'frog' | 'crow' | 'owl';

export interface SceneryWildlifeSpot {
  readonly kind: SceneryKind;
  readonly x: number;
  readonly z: number;
  /** The water's surface, for a duck; everything else stands on the ground. */
  readonly waterLevel?: number;
  /** An owl that is about by day as well as by night. */
  readonly dayOwl?: boolean;
  readonly yaw: number;
}

/** Polyfork's free Duck, Frog, Crow and Owl, sized for the forest. */
const ANIMALS = {
  duck: polyforkAnimal('duck', { walkSpeed: 0.5, runSpeed: 1.6, scale: 0.85 }),
  frog: polyforkAnimal('frog', { walkSpeed: 0.4, runSpeed: 2, scale: 1.6 }),
  crow: polyforkAnimal('crow', { walkSpeed: 0.5, runSpeed: 2, scale: 1.1, flyClip: 'Fly' }),
  owl: polyforkAnimal('owl', { walkSpeed: 0.3, runSpeed: 1.5, scale: 1.2, flyClip: 'Fly' }),
} satisfies Record<SceneryKind, unknown>;

/** Fetches the four up front. Idempotent, like the other model preloads. */
export function preloadSceneryWildlife(): Promise<void> {
  return Promise.all(Object.values(ANIMALS).map((animal) => animal.preload())).then(() => {});
}

/** A living copy of one, or undefined until it has downloaded. */
export function createSceneryAnimal(kind: SceneryKind): AnimatedAnimal | undefined {
  return ANIMALS[kind].create();
}

/** Crows keep to the open ground just past the clearing's trees. */
const CROW_RING = { inner: 34, outer: 90 };
/** Owls keep to the deep woods, as far out as the bears. */
const OWL_RING = { inner: 140, outer: 420 };
const CELL = 24;

/** Where each one lives, the same for everyone in the world. */
export function sceneryWildlifeSpots(
  seed: number,
  pond: readonly WaterCircle[],
): SceneryWildlifeSpot[] {
  const rng = createRng(hashSeed('scenery-wildlife', seed));
  const spots: SceneryWildlifeSpot[] = [];
  const onWater = (x: number, z: number) => isOnWater(pond, x, z) || isOnLake(LAKE, x, z);
  const yaw = () => rng.nextRange(0, Math.PI * 2);

  // A pair of ducks on the home pond, and a scatter across the lake.
  const homePond = [...pond].sort((a, b) => b.radius - a.radius)[0];
  if (homePond !== undefined) {
    for (let index = 0; index < 2; index++) {
      const angle = rng.nextRange(0, Math.PI * 2);
      const reach = rng.nextRange(0, homePond.radius * 0.5);
      spots.push({
        kind: 'duck',
        x: homePond.x + Math.cos(angle) * reach,
        z: homePond.z + Math.sin(angle) * reach,
        waterLevel: POND_LEVEL,
        yaw: yaw(),
      });
    }
  }
  const lake = LAKE.bounds;
  for (let x = lake.minX; x < lake.maxX; x += 18) {
    for (let z = lake.minZ; z < lake.maxZ; z += 18) {
      const at = { x: x + rng.nextRange(0, 18), z: z + rng.nextRange(0, 18) };
      if (rng.nextFloat() < 0.35 && isOnLake(LAKE, at.x, at.z, 0.6))
        spots.push({ kind: 'duck', ...at, waterLevel: LAKE.level, yaw: yaw() });
    }
  }

  // Frogs sit on the bank, a step from the water, round the pond and the lake.
  for (const [circles, chance] of [
    [pond, 0.6],
    [LAKE.basin, 0.25],
  ] as const) {
    for (const circle of circles) {
      const steps = Math.max(3, Math.round((Math.PI * 2 * circle.radius) / 7));
      for (let step = 0; step < steps; step++) {
        const angle = (step / steps) * Math.PI * 2 + rng.nextRange(0, 0.4);
        const x = circle.x + Math.cos(angle) * (circle.radius + 0.8);
        const z = circle.z + Math.sin(angle) * (circle.radius + 0.8);
        if (rng.nextFloat() < chance && !onWater(x, z))
          spots.push({ kind: 'frog', x, z, yaw: angle + Math.PI / 2 });
      }
    }
  }

  // Crows and owls, one cell at a time out to the owls' furthest ring.
  for (let x = -OWL_RING.outer; x < OWL_RING.outer; x += CELL) {
    for (let z = -OWL_RING.outer; z < OWL_RING.outer; z += CELL) {
      const at = { x: x + rng.nextRange(0, CELL), z: z + rng.nextRange(0, CELL) };
      const roll = rng.nextFloat();
      const dayOwl = rng.nextFloat() < 0.2;
      const distance = Math.hypot(at.x, at.z);
      if (onWater(at.x, at.z)) continue;
      if (distance >= CROW_RING.inner && distance <= CROW_RING.outer && roll < 0.25)
        spots.push({ kind: 'crow', ...at, yaw: yaw() });
      else if (distance >= OWL_RING.inner && distance <= OWL_RING.outer && roll < 0.07)
        spots.push({ kind: 'owl', ...at, dayOwl, yaw: yaw() });
    }
  }
  return spots;
}

/** How close someone comes before each one scatters, how it gets away, and how far it roams. */
const MANNER: Record<
  SceneryKind,
  { startle: number; flee: number; roam: number; pace: number; away: 'swim' | 'hop' | 'fly' }
> = {
  duck: { startle: 7, flee: 1, roam: 4, pace: 0.35, away: 'swim' },
  frog: { startle: 3.5, flee: 2.2, roam: 1.2, pace: 0.3, away: 'hop' },
  crow: { startle: 7, flee: 6, roam: 3, pace: 0.45, away: 'fly' },
  owl: { startle: 6, flee: 5, roam: 0, pace: 0, away: 'fly' },
};
/** Within this far of the player they are drawn; past it they are let go. */
const DRAWN_WITHIN = 70;
/** How long one that has fled stays away before it is back at its spot. */
const AWAY_SECONDS = 35;
/** A bird that has flown off is out of sight after this long. */
const FLIGHT_SECONDS = 3;
/** Owls are about once the light falls below this. */
const OWL_DUSK = 0.35;

interface Living {
  readonly spot: SceneryWildlifeSpot;
  readonly model: AnimatedAnimal;
  x: number;
  z: number;
  lift: number;
  yaw: number;
  /** Where it is ambling to, or null while it stands still. */
  target: { x: number; z: number } | null;
  /** Seconds until it next picks somewhere to amble, or until it is back. */
  timer: number;
  fleeing: number;
  away: boolean;
}

export interface SceneryWildlife {
  readonly group: THREE.Group;
  update(
    deltaSeconds: number,
    player: { readonly x: number; readonly z: number },
    daylight: number,
    lakeFrozen: boolean,
    indoors: boolean,
  ): void;
  /** How many of each are drawn just now. */
  drawn(): Record<SceneryKind, number>;
  dispose(): void;
}

export function createSceneryWildlife(
  seed: number,
  pond: readonly WaterCircle[],
  heightAt: (x: number, z: number) => number,
): SceneryWildlife {
  const group = new THREE.Group();
  group.name = 'scenery-wildlife';
  const spots = sceneryWildlifeSpots(seed, pond);
  const living = new Map<SceneryWildlifeSpot, Living>();
  const rng = createRng(hashSeed('scenery-wildlife-moves', seed));
  const onWater = (x: number, z: number) => isOnWater(pond, x, z) || isOnLake(LAKE, x, z, 0.5);
  let sinceSurvey = Infinity;

  const welcome = (spot: SceneryWildlifeSpot) => {
    const model = createSceneryAnimal(spot.kind);
    if (model === undefined) return;
    group.add(model.group);
    living.set(spot, {
      spot,
      model,
      x: spot.x,
      z: spot.z,
      lift: 0,
      yaw: spot.yaw,
      target: null,
      timer: rng.nextRange(1, 4),
      fleeing: 0,
      away: false,
    });
  };
  const letGo = (one: Living) => {
    group.remove(one.model.group);
    one.model.dispose();
    living.delete(one.spot);
  };

  /** Which spots are near enough, and in season, to draw. */
  const survey = (
    player: { readonly x: number; readonly z: number },
    night: boolean,
    frozen: boolean,
  ) => {
    for (const spot of spots) {
      const near = Math.hypot(spot.x - player.x, spot.z - player.z) <= DRAWN_WITHIN;
      const about =
        spot.kind === 'owl'
          ? night || spot.dayOwl === true
          : spot.kind === 'duck' || spot.kind === 'frog'
            ? !frozen
            : true;
      const one = living.get(spot);
      if (near && about && one === undefined) welcome(spot);
      else if ((!near || !about) && one !== undefined) letGo(one);
    }
  };

  const step = (
    one: Living,
    deltaSeconds: number,
    player: { readonly x: number; readonly z: number },
  ) => {
    const manner = MANNER[one.spot.kind];
    const fromPlayer = Math.hypot(one.x - player.x, one.z - player.z);
    if (one.away) {
      one.model.group.visible = false;
      one.timer -= deltaSeconds;
      // Back at its spot once it has been gone a while and nobody is close.
      if (one.timer <= 0 && Math.hypot(one.spot.x - player.x, one.spot.z - player.z) > 15) {
        Object.assign(one, { away: false, x: one.spot.x, z: one.spot.z, lift: 0, fleeing: 0 });
        one.model.group.visible = true;
      }
      return;
    }
    let speed = 0;
    let flying = 0;
    if (one.fleeing === 0 && fromPlayer < manner.startle) one.fleeing = 0.001;
    if (one.fleeing > 0) {
      one.fleeing += deltaSeconds;
      const awayX = (one.x - player.x) / Math.max(fromPlayer, 0.01);
      const awayZ = (one.z - player.z) / Math.max(fromPlayer, 0.01);
      const nextX = one.x + awayX * manner.flee * deltaSeconds;
      const nextZ = one.z + awayZ * manner.flee * deltaSeconds;
      if (manner.away === 'swim') {
        // A duck paddles off but never leaves the water; it settles once clear.
        if (onWater(nextX, nextZ)) Object.assign(one, { x: nextX, z: nextZ });
        speed = manner.flee;
        if (fromPlayer > manner.startle * 1.8) one.fleeing = 0;
      } else {
        Object.assign(one, { x: nextX, z: nextZ });
        speed = manner.flee;
        if (manner.away === 'fly') {
          flying = Math.min(1, one.fleeing * 4);
          one.lift += deltaSeconds * 2.5 * flying;
        }
        const gone = manner.away === 'fly' ? FLIGHT_SECONDS : 0.8;
        if (one.fleeing > gone) Object.assign(one, { away: true, timer: AWAY_SECONDS });
      }
      one.yaw = Math.atan2(-awayX, -awayZ);
    } else if (manner.roam > 0) {
      one.timer -= deltaSeconds;
      if (one.target === null && one.timer <= 0) {
        const angle = rng.nextRange(0, Math.PI * 2);
        const reach = rng.nextRange(0.3, manner.roam);
        const target = {
          x: one.spot.x + Math.cos(angle) * reach,
          z: one.spot.z + Math.sin(angle) * reach,
        };
        // Ducks stay on the water and the others off it.
        if (onWater(target.x, target.z) === (one.spot.kind === 'duck')) one.target = target;
        else one.timer = 1;
      }
      if (one.target !== null) {
        const dx = one.target.x - one.x;
        const dz = one.target.z - one.z;
        const left = Math.hypot(dx, dz);
        if (left < 0.05) {
          one.target = null;
          one.timer = rng.nextRange(2, 6);
        } else {
          const stride = Math.min(left, manner.pace * deltaSeconds);
          one.x += (dx / left) * stride;
          one.z += (dz / left) * stride;
          one.yaw = Math.atan2(-dx, -dz);
          speed = manner.pace;
        }
      }
    }
    const base = one.spot.waterLevel ?? heightAt(one.x, one.z);
    // A duck sits a little down in the water.
    const floating = one.spot.waterLevel === undefined ? 0 : -0.06;
    one.model.group.position.set(one.x, base + floating + one.lift, one.z);
    one.model.group.rotation.y = one.yaw;
    one.model.animate(deltaSeconds, speed, flying);
  };

  return {
    group,
    update(deltaSeconds, player, daylight, lakeFrozen, indoors) {
      group.visible = !indoors;
      if (indoors) return;
      sinceSurvey += deltaSeconds;
      if (sinceSurvey > 0.5) {
        sinceSurvey = 0;
        survey(player, daylight < OWL_DUSK, lakeFrozen);
      }
      for (const one of living.values()) step(one, deltaSeconds, player);
    },
    drawn() {
      const counts: Record<SceneryKind, number> = { duck: 0, frog: 0, crow: 0, owl: 0 };
      for (const one of living.values()) if (!one.away) counts[one.spot.kind]++;
      return counts;
    },
    dispose() {
      for (const one of [...living.values()]) letGo(one);
    },
  };
}
