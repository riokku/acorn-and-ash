import * as THREE from 'three/webgpu';

import {
  basinDepthAt,
  lakeDepthAt,
  lakeIceHeight,
  REED_PATCHES,
  type Lake,
  type WaterCircle,
} from '@acorn/shared';

import { createIceMaterial, createWaterMaterial, paintedMaterial } from '../art/materials';
import { seededRandom } from '../art/noise';
import { ModelBuilder, placed, stoneGeometry } from '../art/shapes';
import { addLilyPad, addReedClump, waterPlantMaterials } from './water-plants';
import { buryGeometryBase } from './prop-grounding';

/** Round discs are cut finely so the water's outline never shows corners, even on the big blobs. */
const DISC_SEGMENTS = 72;
/** Water this deep, from the shore, is the deepest colour. */
const DEEP_WATER_AT = 9;

/** Reeds stand about every this many metres along a shore, in places. */
const REED_SPACING = 5.5;
/** Of those, how many get a clump: the rest of the shore is bare beach. */
const REED_SHARE = 0.55;
/** Scenery reeds keep this far from a reed that can be cut, in metres. */
const REED_PATCH_CLEAR = 2.5;
const LILY_PADS = 26;
const SHORE_STONES = 46;

/**
 * The lake (see decision 0090): one wide sheet of water over the whole basin,
 * with the islands poking up through it, reeds and cattails along the
 * shallows, lily pads, and stones half buried along the bank.
 *
 * The sheet is a flat disc for each circle of the basin, all at the water's
 * level. Where two overlap they wear the same colour at the same height, so
 * the join never shows, the same way the pond is drawn. The islands need no
 * cutting out: the ground rises through the water there, and the water's
 * colour thins to the shallows round them (see `createWaterMaterial`).
 *
 * In winter (decision 0095) the same discs are drawn again as ice, at the
 * height people walk on, and the water is hidden: `setFrozen` swaps one for the
 * other.
 */
export function createLakeScene(
  lake: Lake,
  excludePlantsAt: (x: number, z: number) => boolean = () => false,
  surfaceHeightAt: (x: number, z: number) => number = () => lake.level,
  shoreConnections: readonly WaterCircle[] = [],
  flowAt?: (x: number, z: number) => { x: number; z: number; share: number },
  scenery: { seed?: number; groundHeightAt?: (x: number, z: number) => number } = {},
): {
  group: THREE.Group;
  /** Show the lake as ice (true) or as open water (false). */
  setFrozen(frozen: boolean): void;
  dispose(): void;
} {
  const group = new THREE.Group();
  group.name = 'lake';
  const geometries: THREE.BufferGeometry[] = [];

  const lobes = lake.islands.flatMap((island) => island.lobes);
  const waterMaterial = createWaterMaterial(lake.basin, {
    shoreConnections,
    riverFlow: flowAt !== undefined,
    islands: lobes,
    deepAt: DEEP_WATER_AT,
    deep: 0x1f4f73,
    rippleSize: 1.7,
  });
  const iceMaterial = createIceMaterial();
  const water: THREE.Mesh[] = [];
  const ice: THREE.Mesh[] = [];
  for (const circle of lake.basin) {
    // Extra rings let a slough follow the grade through its whole surface,
    // including the curved transition into the river at its mouth.
    const surface = shoreConnections.length
      ? new THREE.RingGeometry(0, circle.radius, DISC_SEGMENTS, Math.ceil(circle.radius))
      : new THREE.CircleGeometry(circle.radius, DISC_SEGMENTS);
    surface.rotateX(-Math.PI / 2);
    const positions = surface.getAttribute('position');
    for (let vertex = 0; vertex < positions.count; vertex++) {
      positions.setY(
        vertex,
        surfaceHeightAt(circle.x + positions.getX(vertex), circle.z + positions.getZ(vertex)) -
          lake.level,
      );
    }
    surface.computeVertexNormals();
    if (flowAt !== undefined) {
      const flow = new Float32Array(positions.count * 2);
      const share = new Float32Array(positions.count);
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const current = flowAt(
          circle.x + positions.getX(vertex),
          circle.z + positions.getZ(vertex),
        );
        flow[vertex * 2] = current.x;
        flow[vertex * 2 + 1] = current.z;
        share[vertex] = current.share;
      }
      surface.setAttribute('waterFlow', new THREE.BufferAttribute(flow, 2));
      surface.setAttribute('waterFlowShare', new THREE.BufferAttribute(share, 1));
    }
    geometries.push(surface);
    const mesh = new THREE.Mesh(surface, waterMaterial);
    mesh.position.set(circle.x, lake.level, circle.z);
    mesh.receiveShadow = true;
    group.add(mesh);
    water.push(mesh);

    const sheet = new THREE.Mesh(surface, iceMaterial);
    sheet.position.set(circle.x, lakeIceHeight(lake), circle.z);
    sheet.receiveShadow = true;
    sheet.visible = false;
    group.add(sheet);
    ice.push(sheet);
  }

  const plants = createShorePlants(
    lake,
    excludePlantsAt,
    surfaceHeightAt,
    scenery.seed ?? 909,
    scenery.groundHeightAt ?? surfaceHeightAt,
  );
  group.add(plants.group);
  const plantMaterials = waterPlantMaterials();
  const floatingPlants = new Set([
    plantMaterials.pad,
    plantMaterials.padUnder,
    plantMaterials.petal,
    plantMaterials.petalPink,
    plantMaterials.heart,
  ]);

  return {
    group,
    setFrozen: (frozen) => {
      for (const mesh of water) mesh.visible = !frozen;
      for (const mesh of ice) mesh.visible = frozen;
      for (const child of plants.group.children) {
        if (child instanceof THREE.Mesh && floatingPlants.has(child.material as THREE.Material))
          child.visible = !frozen;
      }
    },
    dispose: () => {
      for (const geometry of geometries) geometry.dispose();
      waterMaterial.dispose();
      iceMaterial.dispose();
      plants.dispose();
      group.removeFromParent();
    },
  };
}

/** Every point round a circle's rim, `spacing` metres apart or so, as [x, z, outward x, outward z]. */
function* rimPoints(
  circle: WaterCircle,
  spacing: number,
  random: () => number,
): Generator<[number, number, number, number]> {
  const count = Math.max(4, Math.round((Math.PI * 2 * circle.radius) / spacing));
  const start = random() * Math.PI * 2;
  for (let step = 0; step < count; step++) {
    const angle = start + (step / count) * Math.PI * 2 + (random() - 0.5) * 0.3;
    const outX = Math.cos(angle);
    const outZ = Math.sin(angle);
    yield [circle.x + outX * circle.radius, circle.z + outZ * circle.radius, outX, outZ];
  }
}

/**
 * Reeds in the shallows, lily pads further out, and stones at the water's edge.
 * Seeded, and independent of the world's own seed: the lake is the same in
 * every world, so its plants are too.
 */
function createShorePlants(
  lake: Lake,
  excludePlantsAt: (x: number, z: number) => boolean,
  surfaceHeightAt: (x: number, z: number) => number,
  seed: number,
  groundHeightAt: (x: number, z: number) => number,
): { group: THREE.Group; dispose(): void } {
  const plants = waterPlantMaterials();
  const stone = paintedMaterial('stone', { roughness: 1, flatShading: true });
  const builder = new ModelBuilder();
  const random = seededRandom(seed);
  const level = lake.level;

  // Reeds stand just inside the water's edge, wherever that edge is open to
  // the sky: not where two circles run into each other, which is under water.
  const reedsAlong = (circle: WaterCircle, inwards: 1 | -1): void => {
    for (const [x, z, outX, outZ] of rimPoints(circle, REED_SPACING, random)) {
      if (random() > REED_SHARE) continue;
      // Inwards for the mainland's rim means toward the middle of the circle; for an island, away from it.
      const at = { x: x - outX * 0.35 * inwards, y: level, z: z - outZ * 0.35 * inwards };
      at.y = surfaceHeightAt(at.x, at.z);
      const depth = lakeDepthAt(lake, at.x, at.z);
      if (depth < 0.12 || depth > 1.1) continue;
      if (excludePlantsAt(at.x, at.z)) continue;
      // The reeds that can be cut are drawn by the ground items, so the
      // scenery leaves a gap round each one instead of burying it.
      if (
        REED_PATCHES.some((patch) => Math.hypot(patch.x - at.x, patch.z - at.z) < REED_PATCH_CLEAR)
      )
        continue;
      addReedClump(builder, plants, random, at, 5 + Math.floor(random() * 3));
    }
  };
  for (const circle of lake.basin) reedsAlong(circle, 1);
  for (const island of lake.islands) {
    // An island's reeds stand in the water round it, so "inwards" is out from its middle.
    for (const lobe of island.lobes) reedsAlong(lobe, -1);
  }

  // Lily pads where the water is shallow but not at the very edge.
  let placedPads = 0;
  for (let attempt = 0; attempt < LILY_PADS * 40 && placedPads < LILY_PADS; attempt++) {
    const circle = lake.basin[Math.floor(random() * lake.basin.length)];
    if (circle === undefined) break;
    const angle = random() * Math.PI * 2;
    const reach = Math.sqrt(random()) * circle.radius;
    const at = {
      x: circle.x + Math.cos(angle) * reach,
      y: level,
      z: circle.z + Math.sin(angle) * reach,
    };
    const depth = lakeDepthAt(lake, at.x, at.z);
    at.y = surfaceHeightAt(at.x, at.z);
    if (depth < 1.4 || depth > 4.5) continue;
    if (excludePlantsAt(at.x, at.z)) continue;
    const flower = random() < 0.3 ? (random() < 0.5 ? 'white' : 'pink') : null;
    addLilyPad(
      builder,
      plants,
      at,
      0.28 + random() * 0.2,
      random() * Math.PI * 2,
      flower,
      surfaceHeightAt,
    );
    placedPads += 1;
  }

  // Stones half buried at the water's edge, on the mainland's rim only.
  let placedStones = 0;
  for (let attempt = 0; attempt < SHORE_STONES * 30 && placedStones < SHORE_STONES; attempt++) {
    const circle = lake.basin[Math.floor(random() * lake.basin.length)];
    if (circle === undefined) break;
    const angle = random() * Math.PI * 2;
    const x = circle.x + Math.cos(angle) * (circle.radius + 0.1);
    const z = circle.z + Math.sin(angle) * (circle.radius + 0.1);
    // Not where two circles overlap: that rim is under water.
    if (basinDepthAt(lake, x, z) > -0.05) continue;
    if (excludePlantsAt(x, z)) continue;
    const size = 0.18 + random() * 0.32;
    const y = groundHeightAt(x, z);
    builder.add(
      stone,
      buryGeometryBase(
        stoneGeometry(size, size * 0.55, 800 + placedStones, 0.5, 0),
        { x, y, z },
        groundHeightAt,
      ),
      placed(x, y, z, { y: random() * 3 }),
    );
    placedStones += 1;
  }

  return builder.build();
}
