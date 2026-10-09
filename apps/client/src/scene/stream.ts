import * as THREE from 'three/webgpu';

import {
  STREAM_STONES_PER_100M,
  streamBedAt,
  streamFallGradientAt,
  streamPointAt,
  streamSurfaceAt,
  streamWaterHalfWidthAt,
  lakeDepthAt,
  basinDepthAt,
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
/** Water is quick down the falls and slow on the flat. */
const FALL_PACE = 2.6;

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

  const connections = stream.sloughs.map((slough) => {
    const pool = slough.basin[0]!;
    const mouth = nearestOnStream(stream, pool.x, pool.z, 30)!;
    const mouthRow = Math.round(mouth.along / (stream.length / (stream.count - 1)));
    return [-4, -2, 0, 2, 4].map((offset) => {
      const row = Math.max(0, Math.min(stream.count - 1, mouthRow + offset));
      const along = row * (stream.length / (stream.count - 1));
      return { ...streamPointAt(stream, row), radius: streamWaterHalfWidthAt(stream, along) };
    });
  });
  const material = createStreamMaterial(
    stream.sloughs.flatMap((slough) => slough.basin),
    connections.flat(),
  );
  const ribbon = ribbonGeometry(stream);
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
  const reeds = createBankReeds(stream, terrain);
  group.add(reeds.group);
  const sloughs = stream.sloughs.map((slough, index) => {
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
        const steep = Math.min(streamFallGradientAt(stream, spot.along) / FULL_FOAM_GRADIENT, 1);
        const pace = 1 + steep * (FALL_PACE - 1);
        const half = streamWaterHalfWidthAt(stream, spot.along);
        return {
          x: ((after.x - before.x) / size) * pace,
          z: ((after.z - before.z) / size) * pace,
          share: 1 - smoothstep(spot.distance, half + 1, half + 8),
        };
      },
      { seed: 1909 + index * 137, groundHeightAt: (x, z) => terrain.heightAt(x, z) },
    );
    scene.group.name = `slough-${index + 1}`;
    group.add(scene.group);
    return scene;
  });
  const boulders = createSloughBoulders(stream, terrain);
  group.add(boulders.group);

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
      reeds.dispose();
      boulders.dispose();
      for (const slough of sloughs) slough.dispose();
      group.removeFromParent();
    },
  };
}

/** Different loose groups of larger, embedded stones on each slough's dry banks. */
function createSloughBoulders(
  stream: Stream,
  terrain: Terrain,
): { group: THREE.Group; dispose(): void } {
  const stone = paintedMaterial('stone', { roughness: 1, flatShading: true });
  const builder = new ModelBuilder();
  for (const [index, slough] of stream.sloughs.entries()) {
    const random = seededRandom(2909 + index * 137);
    const count = 4 + Math.floor(random() * 4);
    const placedRocks: { x: number; z: number; radius: number }[] = [];
    for (let attempt = 0; attempt < 120 && placedRocks.length < count; attempt++) {
      // The two outer pool lobes, leaving the broad river mouth open.
      const circle = slough.basin[Math.floor(random() * 2)]!;
      const angle = random() * Math.PI * 2;
      const radius = 0.7 + random() * 1.1;
      const reach = circle.radius + radius * 0.8 + random() * 1.8;
      const x = circle.x + Math.cos(angle) * reach;
      const z = circle.z + Math.sin(angle) * reach;
      if (isInStream(stream, x, z, -radius - 0.8)) continue;
      if (stream.sloughs.some((pool) => basinDepthAt(pool, x, z) > -radius * 0.7)) continue;
      if (placedRocks.some((rock) => Math.hypot(x - rock.x, z - rock.z) < radius + rock.radius))
        continue;
      const height = radius * (0.65 + random() * 0.45);
      // Embed the base across its footprint, rather than floating a rock off
      // the downhill side of a slope. Reject banks too steep for this rock.
      const heights = [terrain.heightAt(x, z)];
      for (let edge = 0; edge < 8; edge++) {
        const turn = (edge / 8) * Math.PI * 2;
        heights.push(terrain.heightAt(x + Math.cos(turn) * radius, z + Math.sin(turn) * radius));
      }
      const base = Math.min(...heights);
      if (Math.max(...heights) - base > height * 0.8) continue;
      const y = base - height * 0.12;
      builder.add(
        stone,
        buryGeometryBase(
          stoneGeometry(radius, height, 3909 + index * 137 + placedRocks.length, 0.8, 1),
          { x, y, z },
          (x, z) => terrain.heightAt(x, z),
        ),
        placed(x, y, z, { y: random() * Math.PI * 2 }),
      );
      placedRocks.push({ x, z, radius });
    }
  }
  const result = builder.build();
  result.group.name = 'slough-boulders';
  return result;
}

/** The lake's green reeds and cattails in loose clusters on both riverbanks. */
function createBankReeds(
  stream: Stream,
  terrain: Terrain,
): { group: THREE.Group; dispose(): void } {
  const builder = new ModelBuilder();
  const materials = waterPlantMaterials();
  const random = seededRandom(1515);
  const step = Math.max(1, Math.round(5.5 / (stream.length / (stream.count - 1))));
  for (let row = step; row < stream.count - 1; row += step) {
    const along = row * (stream.length / (stream.count - 1));
    // Leave the rushing falls bare; reeds prefer the quiet shallows.
    if (streamFallGradientAt(stream, along) > 0.18) continue;
    const here = streamPointAt(stream, row);
    const before = streamPointAt(stream, row - 1);
    const after = streamPointAt(stream, row + 1);
    const size = Math.hypot(after.x - before.x, after.z - before.z) || 1;
    const surface = streamSurfaceAt(stream, along);
    for (const side of [-1, 1]) {
      if (random() > 0.65) continue;
      const across = side * (streamWaterHalfWidthAt(stream, along) - 0.25 - random() * 0.35);
      const x = here.x - ((after.z - before.z) / size) * across;
      const z = here.z + ((after.x - before.x) / size) * across;
      const ground = terrain.heightAt(x, z);
      if (ground > surface + 0.08 || surface - ground > 0.65) continue;
      // A slough already supplies its own shore plants.
      if (stream.sloughs.some((slough) => lakeDepthAt(slough, x, z) > 0)) continue;
      addReedClump(builder, materials, random, { x, y: ground, z }, 5 + Math.floor(random() * 4));
    }
  }
  const scene = builder.build();
  scene.group.name = 'riverbank-reeds';
  return scene;
}

function ribbonGeometry(stream: Stream): THREE.BufferGeometry {
  const rows = stream.count;
  const positions = new Float32Array(rows * ACROSS * 3);
  // WebGPU guarantees only eight vertex buffers. Pack the custom water
  // values together so the ribbon uses just three buffers with position/normal.
  const waterValues = new Float32Array(rows * ACROSS * 8);
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
    const half = streamWaterHalfWidthAt(stream, along) * EDGE_OVERLAP;
    const surface = streamSurfaceAt(stream, along);
    const steep = Math.min(streamFallGradientAt(stream, along) / FULL_FOAM_GRADIENT, 1);
    for (let column = 0; column < ACROSS; column++) {
      const across = (column / (ACROSS - 1)) * 2 - 1;
      const vertex = row * ACROSS + column;
      positions[vertex * 3] = here.x + normalX * half * across;
      positions[vertex * 3 + 1] = surface;
      positions[vertex * 3 + 2] = here.z + normalZ * half * across;
      const pace = 1 + steep * (FALL_PACE - 1);
      const water = vertex * 8;
      waterValues[water] = half * across;
      waterValues[water + 1] = along;
      waterValues[water + 2] = Math.abs(across);
      waterValues[water + 3] = steep;
      waterValues[water + 4] = pace;
      waterValues[water + 5] = (tangentX / size) * pace;
      waterValues[water + 6] = (tangentZ / size) * pace;
      waterValues[water + 7] = 1;
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
  const waterBuffer = new THREE.InterleavedBuffer(waterValues, 8);
  geometry.setAttribute('streamAcross', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 0));
  geometry.setAttribute('streamAlong', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 1));
  geometry.setAttribute('streamEdge', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 2));
  geometry.setAttribute('streamFall', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 3));
  geometry.setAttribute('streamPace', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 4));
  geometry.setAttribute('waterFlow', new THREE.InterleavedBufferAttribute(waterBuffer, 2, 5));
  geometry.setAttribute('waterFlowShare', new THREE.InterleavedBufferAttribute(waterBuffer, 1, 7));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Stones in the shallows and along the banks: rounded, half buried, from pebbles to boulders. */
function createStones(stream: Stream, terrain: Terrain): { group: THREE.Group; dispose(): void } {
  const stone = paintedMaterial('stone', { roughness: 1, flatShading: true });
  const builder = new ModelBuilder();
  const random = seededRandom(1414);
  const count = Math.round((stream.length / 100) * STREAM_STONES_PER_100M);
  for (let index = 0; index < count; index++) {
    const along = random() * stream.length;
    const row = Math.min(
      stream.count - 1,
      Math.round(along / (stream.length / (stream.count - 1))),
    );
    const here = streamPointAt(stream, row);
    const before = streamPointAt(stream, Math.max(0, row - 1));
    const after = streamPointAt(stream, Math.min(stream.count - 1, row + 1));
    const size = Math.hypot(after.x - before.x, after.z - before.z) || 1;
    const normalX = -(after.z - before.z) / size;
    const normalZ = (after.x - before.x) / size;
    const half = streamWaterHalfWidthAt(stream, along);
    // Mostly in the water or at its lip, a few further up the bank.
    const across = (random() * 2 - 1) * (half + 0.9);
    const x = here.x + normalX * across;
    const z = here.z + normalZ * across;
    const radius = 0.14 + random() * random() * 0.55;
    const ground = Math.max(terrain.heightAt(x, z), streamBedAt(stream, along) - 0.2);
    const y = ground + radius * 0.12;
    builder.add(
      stone,
      buryGeometryBase(
        stoneGeometry(radius, radius * 0.6, 1400 + index, 0.5, 0),
        { x, y, z },
        (x, z) => terrain.heightAt(x, z),
      ),
      placed(x, y, z, { y: random() * Math.PI * 2 }),
    );
  }
  return builder.build();
}
