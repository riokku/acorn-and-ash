import * as THREE from 'three/webgpu';
import { createRng, hashSeed, type ForestWeather, type SeasonMix } from '@acorn/shared';

import { fallFor, type FallAmounts, type FallKind } from '../art/season-fall';

/** Side of the square of air kept in front of the camera, in metres. Things leave one edge and enter the other. */
const SPAN = 28;
const HALF = SPAN / 2;

interface Pool {
  readonly mesh: THREE.InstancedMesh;
  /** The most there can ever be: nothing is added or removed while playing. */
  readonly max: number;
  /** How tall the column of air is, in metres above the ground. */
  readonly height: number;
  /** Metres per second down (0 for things that float). */
  readonly fall: number;
  /** How far each one sways from side to side, in metres. */
  readonly sway: number;
  /** How fast it tumbles. 0 keeps it facing the way it was made. */
  readonly spin: number;
  /** How hard the wind pushes it along, in metres per second at full wind. */
  readonly drift: number;
  readonly dispose: () => void;
}

interface Grain {
  x: number;
  z: number;
  height: number;
  phase: number;
  scale: number;
  speed: number;
}

const LEAF_COLOURS = [0xc9742a, 0xd9a13a, 0xa6492a, 0x8c5a2b, 0xe0b04a];
const PETAL_COLOURS = [0xf6d5df, 0xfff2f4, 0xf2b8cb];

/** The remainder after dividing, kept above zero, so wrapping works the same either side of zero. */
function wrap(value: number, size: number): number {
  return ((value % size) + size) % size;
}

function makePool(
  kind: FallKind,
  geometry: THREE.BufferGeometry,
  material: THREE.MeshBasicMaterial,
  settings: Omit<Pool, 'mesh' | 'dispose'>,
  colours: readonly number[] | null,
  rng: ReturnType<typeof createRng>,
): Pool {
  const mesh = new THREE.InstancedMesh(geometry, material, settings.max);
  mesh.name = `season-${kind}`;
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.visible = false;
  if (colours !== null) {
    const colour = new THREE.Color();
    for (let i = 0; i < settings.max; i++) {
      mesh.setColorAt(i, colour.set(colours[rng.nextInt(colours.length)] ?? 0xffffff));
    }
  }
  return {
    ...settings,
    mesh,
    dispose() {
      mesh.dispose();
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * The things that drift through the air as the year turns (see decision 0089):
 * blossom petals, golden pollen, falling leaves and snowflakes.
 *
 * Like the rain, it is bounded and pooled: a fixed handful of instanced
 * shapes, built once, that follow the camera. Nothing is made or thrown away
 * while playing. Each one stays where it is in the world and is wrapped round
 * to the far side of a square of air in front of the camera, so walking
 * through them feels like walking through them.
 */
export function createSeasonFall(seed: number, heightAt: (x: number, z: number) => number) {
  const group = new THREE.Group();
  group.name = 'season-fall';
  const rng = createRng(hashSeed('season-fall', seed));

  const pools: Record<FallKind, Pool> = {
    petals: makePool(
      'petals',
      new THREE.PlaneGeometry(0.16, 0.115),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      { max: 110, height: 9, fall: 0.45, sway: 1.1, spin: 2.2, drift: 0.9 },
      PETAL_COLOURS,
      rng,
    ),
    pollen: makePool(
      'pollen',
      new THREE.SphereGeometry(0.04, 5, 4),
      new THREE.MeshBasicMaterial({
        color: 0xffe48a,
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
      }),
      { max: 100, height: 3.2, fall: 0, sway: 0.6, spin: 0, drift: 0.2 },
      null,
      rng,
    ),
    leaves: makePool(
      'leaves',
      new THREE.PlaneGeometry(0.24, 0.17),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
      { max: 140, height: 10, fall: 0.85, sway: 1.4, spin: 3.2, drift: 1.4 },
      LEAF_COLOURS,
      rng,
    ),
    snow: makePool(
      'snow',
      new THREE.SphereGeometry(0.06, 5, 4),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      }),
      { max: 1000, height: 12, fall: 1.1, sway: 0.7, spin: 0, drift: 0.7 },
      null,
      rng,
    ),
  };

  const kinds = Object.keys(pools) as FallKind[];
  const grains: Record<FallKind, Grain[]> = { petals: [], pollen: [], leaves: [], snow: [] };
  for (const kind of kinds) {
    const pool = pools[kind];
    group.add(pool.mesh);
    for (let i = 0; i < pool.max; i++) {
      grains[kind].push({
        x: rng.nextRange(0, SPAN),
        z: rng.nextRange(0, SPAN),
        height: rng.nextRange(0, pool.height),
        phase: rng.nextRange(0, Math.PI * 2),
        scale: rng.nextRange(0.7, 1.35),
        speed: rng.nextRange(0.8, 1.2),
      });
    }
  }

  const dummy = new THREE.Object3D();
  let seconds = 0;

  function place(kind: FallKind, count: number, point: { x: number; z: number }, wind: number) {
    const pool = pools[kind];
    pool.mesh.count = count;
    pool.mesh.visible = count > 0;
    if (count === 0) return;
    const t = seconds;
    // Pollen hangs in the air at about head height instead of coming down.
    const floats = pool.fall === 0;
    for (let i = 0; i < count; i++) {
      const grain = grains[kind][i]!;
      const sway = Math.sin(t * 0.7 * grain.speed + grain.phase) * pool.sway;
      const along = grain.x + sway + t * pool.drift * wind;
      const across = grain.z + Math.cos(t * 0.5 * grain.speed + grain.phase) * pool.sway * 0.6;
      const x = point.x + wrap(along - point.x, SPAN) - HALF;
      const z = point.z + wrap(across - point.z, SPAN) - HALF;
      const above = wrap(grain.height - t * pool.fall * grain.speed, pool.height);
      const lift = floats ? 0.5 + Math.sin(t * 0.6 + grain.phase) * 0.35 : 0;
      dummy.position.set(x, heightAt(x, z) + above + lift, z);
      // Shrink to nothing at the top and bottom of the column, so none of them pop in or out.
      const edge = floats
        ? 1
        : Math.max(0.001, Math.min(1, above / 0.8, (pool.height - above) / 1.5));
      dummy.scale.setScalar(grain.scale * edge);
      if (pool.spin > 0) {
        dummy.rotation.set(
          t * pool.spin * 0.7 * grain.speed + grain.phase,
          t * pool.spin * 0.4 + grain.phase * 2,
          t * pool.spin * grain.speed,
        );
      }
      dummy.updateMatrix();
      pool.mesh.setMatrixAt(i, dummy.matrix);
    }
    pool.mesh.instanceMatrix.needsUpdate = true;
  }

  /** How full each pool is, once the weather and the time of day have had their say. */
  function densities(
    amounts: FallAmounts,
    weather: ForestWeather,
    daylight: number,
  ): Record<FallKind, number> {
    if (weather.kind === 'blizzard') return { petals: 0, pollen: 0, leaves: 0, snow: 1 };
    const windy = 0.55 + 0.45 * Math.min(1, weather.wind / 0.45);
    const sunlit = Math.max(0, Math.min(1, (daylight - 0.5) * 2));
    return {
      petals: amounts.petals,
      pollen: amounts.pollen * sunlit,
      leaves: amounts.leaves * windy,
      snow: amounts.snow * (0.23 + 0.15 * weather.precipitation),
    };
  }

  return {
    group,
    /** How many of each are drifting in view right now. */
    visibleEffects: (): Record<FallKind, number> => ({
      petals: group.visible && pools.petals.mesh.visible ? pools.petals.mesh.count : 0,
      pollen: group.visible && pools.pollen.mesh.visible ? pools.pollen.mesh.count : 0,
      leaves: group.visible && pools.leaves.mesh.visible ? pools.leaves.mesh.count : 0,
      snow: group.visible && pools.snow.mesh.visible ? pools.snow.mesh.count : 0,
    }),
    update(
      delta: number,
      /** The middle of the square of air to fill: a little way in front of the camera. */
      point: { x: number; z: number },
      mix: SeasonMix,
      weather: ForestWeather,
      daylight: number,
      indoors: boolean,
      reducedMotion: boolean,
    ) {
      group.visible = !indoors;
      seconds += Math.min(delta, 0.1);
      const amounts = densities(fallFor(mix), weather, daylight);
      for (const kind of kinds) {
        // Like the rain, nothing falls for anyone who has asked for less movement.
        const count = reducedMotion || indoors ? 0 : Math.round(pools[kind].max * amounts[kind]);
        place(kind, count, point, weather.kind === 'blizzard' ? weather.wind * 7 : weather.wind);
      }
    },
    dispose() {
      for (const kind of kinds) pools[kind].dispose();
      group.removeFromParent();
    },
  };
}
