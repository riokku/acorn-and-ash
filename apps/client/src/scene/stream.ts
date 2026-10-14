import {
  buildStreamStones,
  buildSpringRocks,
  buildSloughBoulders,
  buildWaterfallRocks,
  type SceneryRock,
} from '@acorn/shared';
import * as THREE from 'three/webgpu';

import {
  signedStreamAcross,
  streamPools,
  LAKE,
  streamWaterDepthAt,
  streamFallGradientAt,
  streamFlowPaceAt,
  streamPointAt,
  streamSurfaceAt,
  streamWaterHalfWidthAt,
  lakeDepthAt,
  isInStream,
  nearestOnStream,
  sloughSurfaceAt,
  smoothstep,
  type Stream,
  type Terrain,
} from '@acorn/shared';

import { createIceMaterial, createStreamMaterial, paintedMaterial } from '../art/materials';
import { seededRandom } from '../art/noise';
import { ModelBuilder, placed, stoneGeometry } from '../art/shapes';
import { createLakeScene } from './lake';
import { addReedClump, waterPlantMaterials } from './water-plants';
import { buryGeometryBase } from './prop-grounding';

/** The ribbon of water is this many vertices across: more makes the edges follow the bank's curve better. */
const ACROSS = 7;
/** The ribbon reaches a touch past the water's edge, so the bank never shows a gap. */
const EDGE_OVERLAP = 1.04;
/** A drop this steep (rise over run along the stream) is all foam. */
const FULL_FOAM_GRADIENT = 0.5;

/** Water joining the lake erases its old shoreline across the river mouth. */
export function riverMouthConnections(stream: Stream) {
  return [0, 2, 4, 6, 8].map((back) => {
    const row = Math.max(0, stream.count - 1 - back);
    const along = row * (stream.length / (stream.count - 1));
    return { ...streamPointAt(stream, row), radius: streamWaterHalfWidthAt(stream, along) };
  });
}

/** The spring's actual outlet must erase its shore rim across the flowing channel. */
export function riverPoolConnections(stream: Stream, pool: Stream['sloughs'][number]) {
  const spacing = stream.length / (stream.count - 1);
  const anchor = pool.basin[0]!;
  const mouth = nearestOnStream(stream, anchor.x, anchor.z, 30)!;
  const start = Math.round(mouth.along / spacing);
  if (pool !== stream.spring) {
    return [-4, -2, 0, 2, 4].map((offset) => {
      const row = Math.max(0, Math.min(stream.count - 1, start + offset));
      return {
        ...streamPointAt(stream, row),
        radius: streamWaterHalfWidthAt(stream, row * spacing),
      };
    });
  }
  const end = Math.max(
    ...pool.basin.map((circle) =>
      Math.round(nearestOnStream(stream, circle.x, circle.z, 30)!.along / spacing),
    ),
  );
  const circles = [];
  for (let row = Math.max(0, start - 4); row <= Math.min(stream.count - 1, end + 6); row += 2) {
    const along = row * spacing;
    circles.push({
      ...streamPointAt(stream, row),
      radius: streamWaterHalfWidthAt(stream, along) + 0.4,
    });
  }
  return circles;
}

/**
 * The stream (see decision 0114): a ribbon of water that follows the winding
 * path from the spring to the lake, stepping down over each fall, with stones
 * along its banks and in its shallows.
 *
 * It is one mesh. Each vertex knows how far across and along the stream it is,
 * and how steep the water is there, so the ripples run downstream and white
 * foam gathers at the falls and the edges (see `createStreamMaterial`).
 */
export function createStreamScene(
  stream: Stream,
  terrain: Terrain,
): { group: THREE.Group; setFrozen(frozen: boolean): void; dispose(): void } {
  const group = new THREE.Group();
  group.name = 'stream';

  const connections = streamPools(stream).map((pool) => riverPoolConnections(stream, pool));
  const material = createStreamMaterial(
    streamPools(stream).flatMap((slough) => slough.basin),
    connections.flat(),
    LAKE,
    riverMouthConnections(stream),
  );
  const ribbon = ribbonGeometry(stream, terrain);
  const mesh = new THREE.Mesh(ribbon, material);
  mesh.name = 'stream-water';
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  group.add(mesh);
  const iceMaterial = createIceMaterial();
  const ice = new THREE.Mesh(ribbon, iceMaterial);
  ice.name = 'stream-ice';
  ice.position.y = 0.05;
  ice.receiveShadow = true;
  ice.visible = false;
  group.add(ice);

  const stones = createStones(stream, terrain);
  group.add(stones.group);
  const waterfallRocks = createWaterfallRocks(stream, terrain);
  group.add(waterfallRocks.group);
  const reeds = createBankReeds(stream, terrain);
  group.add(reeds.group);
  const sloughs = streamPools(stream).map((slough, index) => {
    const scene = createLakeScene(
      slough,
      (x, z) => isInStream(stream, x, z, -0.3),
      (x, z) => sloughSurfaceAt(stream, slough, x, z),
      connections[index],
      (x, z) => {
        const spot = nearestOnStream(stream, x, z, 24);
        if (spot === null) return { x: 0, z: 0, share: 0 };
        const row = Math.round(spot.along / (stream.length / (stream.count - 1)));
        const before = streamPointAt(stream, Math.max(0, row - 1));
        const after = streamPointAt(stream, Math.min(stream.count - 1, row + 1));
        const size = Math.hypot(after.x - before.x, after.z - before.z) || 1;
        const pace = streamFlowPaceAt(stream, spot.along);
        const half = streamWaterHalfWidthAt(
          stream,
          spot.along,
          signedStreamAcross(stream, spot, x, z),
        );
        return {
          x: ((after.x - before.x) / size) * pace,
          z: ((after.z - before.z) / size) * pace,
          share: 1 - smoothstep(spot.distance, half + 1, half + 8),
        };
      },
      {
        seed: 1909 + index * 137,
        lilyPads: slough !== stream.spring,
        groundHeightAt: (x, z) => terrain.heightAt(x, z),
        waterDepthAt: (x, z) =>
          Math.max(0, sloughSurfaceAt(stream, slough, x, z) - terrain.heightAt(x, z)),
      },
    );
    scene.group.name = slough === stream.spring ? 'mountain-spring' : `slough-${index + 1}`;
    group.add(scene.group);
    return scene;
  });
  const boulders = createSloughBoulders(stream, terrain);
  group.add(boulders.group);
  const springRocks = createSpringRocks(stream, terrain);
  group.add(springRocks.group);

  return {
    group,
    setFrozen: (frozen) => {
      mesh.visible = !frozen;
      ice.visible = frozen;
      for (const slough of sloughs) slough.setFrozen(frozen);
    },
    dispose: () => {
      ribbon.dispose();
      material.dispose();
      iceMaterial.dispose();
      stones.dispose();
      waterfallRocks.dispose();
      reeds.dispose();
      boulders.dispose();
      springRocks.dispose();
      for (const slough of sloughs) slough.dispose();
      group.removeFromParent();
    },
  };
}

/** A broken upstream crescent suggests water emerging from a mountain rock shelf. */
function createSpringRocks(stream: Stream, terrain: Terrain) {
  return createRockGroup(buildSpringRocks(stream, terrain), terrain, 'mountain-spring-rocks');
}

/** Loose rock shelves frame each drop without crossing the flowing channel. */
function createWaterfallRocks(stream: Stream, terrain: Terrain) {
  return createRockGroup(buildWaterfallRocks(stream, terrain), terrain, 'waterfall-rocks');
}

/** Different loose groups of larger, embedded stones on each slough's dry banks. */
function createSloughBoulders(stream: Stream, terrain: Terrain) {
  return createRockGroup(buildSloughBoulders(stream, terrain), terrain, 'slough-boulders');
}

/** The lake's green reeds and cattails in loose clusters on both riverbanks. */
function createBankReeds(
  stream: Stream,
  terrain: Terrain,
): { group: THREE.Group; dispose(): void } {
  const builder = new ModelBuilder();
  const materials = waterPlantMaterials();
  const random = seededRandom(1515);
  // Uneven gaps along the banks, independent sides and occasional loose
  // groups replace the old regular rows of matching clumps.
  for (let along = 3 + random() * 6; along < stream.length - 4; along += 2.5 + random() * 9) {
    if (streamFallGradientAt(stream, along) > 0.18) continue;
    const sample = along / (stream.length / (stream.count - 1));
    const row = Math.floor(sample);
    const before = streamPointAt(stream, Math.max(0, row - 1));
    const here = streamPointAt(stream, row);
    const after = streamPointAt(stream, Math.min(stream.count - 1, row + 1));
    const blend = sample - row;
    const middleX = here.x + (after.x - here.x) * blend;
    const middleZ = here.z + (after.z - here.z) * blend;
    const size = Math.hypot(after.x - before.x, after.z - before.z) || 1;
    const tx = (after.x - before.x) / size,
      tz = (after.z - before.z) / size;
    const surface = streamSurfaceAt(stream, along);
    for (const side of [-1, 1]) {
      if (random() > 0.55) continue;
      const count = 1 + Math.floor(random() * 3);
      for (let clump = 0; clump < count; clump++) {
        const across = side * (streamWaterHalfWidthAt(stream, along, side) - 0.1 - random() * 0.65);
        const stagger = (random() - 0.5) * 2.8;
        const x = middleX - tz * across + tx * stagger;
        const z = middleZ + tx * across + tz * stagger;
        const ground = terrain.heightAt(x, z);
        if (ground > surface + 0.08 || surface - ground > 0.65) continue;
        if (streamPools(stream).some((slough) => lakeDepthAt(slough, x, z) > 0)) continue;
        addReedClump(
          builder,
          materials,
          random,
          { x, y: ground - 0.04, z },
          3 + Math.floor(random() * 10),
        );
      }
    }
  }
  const scene = builder.build();
  scene.group.name = 'riverbank-reeds';
  return scene;
}

function ribbonGeometry(stream: Stream, terrain: Terrain): THREE.BufferGeometry {
  const rows = stream.count;
  const positions = new Float32Array(rows * ACROSS * 3);
  // WebGPU guarantees only eight vertex buffers. Pack the custom water
  // values together so the ribbon uses just three buffers with position/normal.
  const waterValues = new Float32Array(rows * ACROSS * 10);
  const indices: number[] = [];

  for (let row = 0; row < rows; row++) {
    const along = row * (stream.length / (rows - 1));
    const here = streamPointAt(stream, row);
    const before = streamPointAt(stream, Math.max(0, row - 1));
    const after = streamPointAt(stream, Math.min(rows - 1, row + 1));
    const tangentX = after.x - before.x;
    const tangentZ = after.z - before.z;
    const size = Math.hypot(tangentX, tangentZ) || 1;
    // Left of the way the water runs.
    const normalX = -tangentZ / size;
    const normalZ = tangentX / size;

    const surface = streamSurfaceAt(stream, along);
    const steep = Math.min(streamFallGradientAt(stream, along) / FULL_FOAM_GRADIENT, 1);
    for (let column = 0; column < ACROSS; column++) {
      const across = (column / (ACROSS - 1)) * 2 - 1;
      const half = streamWaterHalfWidthAt(stream, along, across) * EDGE_OVERLAP;
      const vertex = row * ACROSS + column;
      positions[vertex * 3] = here.x + normalX * half * across;
      positions[vertex * 3 + 1] = surface;
      positions[vertex * 3 + 2] = here.z + normalZ * half * across;
      const pace = streamFlowPaceAt(stream, along);
      const water = vertex * 10;
      waterValues[water] = half * across;
      waterValues[water + 1] = along;
      waterValues[water + 2] = Math.abs(across);
      waterValues[water + 3] = steep;
      waterValues[water + 4] = pace;
      waterValues[water + 5] = (tangentX / size) * pace;
      waterValues[water + 6] = (tangentZ / size) * pace;
      waterValues[water + 7] = 1;
      waterValues[water + 8] = streamWaterDepthAt(
        stream,
        positions[vertex * 3]!,
        positions[vertex * 3 + 2]!,
      );
      waterValues[water + 9] = Math.max(
        0,
        surface - terrain.heightAt(positions[vertex * 3]!, positions[vertex * 3 + 2]!),
      );
    }
    if (row + 1 < rows) {
      for (let column = 0; column + 1 < ACROSS; column++) {
        const a = row * ACROSS + column;
        const b = a + 1;
        const c = a + ACROSS;
        const d = c + 1;
        // Wound so the surface faces up.
        indices.push(a, b, c, b, d, c);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const waterBuffer = new THREE.InterleavedBuffer(waterValues, 10);
  geometry.setAttribute('streamAcross', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 0));
  geometry.setAttribute('streamAlong', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 1));
  geometry.setAttribute('streamEdge', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 2));
  geometry.setAttribute('streamFall', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 3));
  geometry.setAttribute('streamPace', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 4));
  geometry.setAttribute('waterFlow', new THREE.InterleavedBufferAttribute(waterBuffer, 2, 5));
  geometry.setAttribute('waterFlowShare', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 7));
  geometry.setAttribute('streamDepth', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 8));
  geometry.setAttribute('waterDepth', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 9));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Stones in the shallows and along the banks: rounded, half buried, from pebbles to boulders. */
function createStones(stream: Stream, terrain: Terrain) {
  return createRockGroup(buildStreamStones(stream, terrain), terrain, 'stream-stones');
}

function createRockGroup(rocks: readonly SceneryRock[], terrain: Terrain, name: string) {
  const builder = new ModelBuilder();
  const material = paintedMaterial('stone', { roughness: 1, flatShading: true });
  for (const rock of rocks)
    builder.add(
      material,
      buryGeometryBase(
        stoneGeometry(rock.radius, rock.height, rock.seed, rock.tile, rock.detail),
        rock,
        (x, z) => terrain.heightAt(x, z),
      ),
      placed(rock.x, rock.y, rock.z, { y: rock.yaw }),
    );
  const result = builder.build();
  result.group.name = name;
  return result;
}
