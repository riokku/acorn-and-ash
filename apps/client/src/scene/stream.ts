import * as THREE from 'three/webgpu';

import {
  STREAM_STONES_PER_100M,
  streamBedAt,
  streamFallGradientAt,
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

import { createStreamMaterial, paintedMaterial } from '../art/materials';
import { seededRandom } from '../art/noise';
import { ModelBuilder, placed, stoneGeometry } from '../art/shapes';
import { createLakeScene } from './lake';
import { addReedClump, waterPlantMaterials } from './water-plants';

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
): { group: THREE.Group; dispose(): void } {
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
    );
    scene.group.name = `slough-${index + 1}`;
    group.add(scene.group);
    return scene;
  });

  return {
    group,
    dispose: () => {
      ribbon.dispose();
      material.dispose();
      stones.dispose();
      reeds.dispose();
      for (const slough of sloughs) slough.dispose();
      group.removeFromParent();
    },
  };
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
  const sideways = new Float32Array(rows * ACROSS);
  const alongs = new Float32Array(rows * ACROSS);
  const edges = new Float32Array(rows * ACROSS);
  const falls = new Float32Array(rows * ACROSS);
  const paces = new Float32Array(rows * ACROSS);
  const flow = new Float32Array(rows * ACROSS * 2);
  const flowShare = new Float32Array(rows * ACROSS).fill(1);
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
      sideways[vertex] = half * across;
      alongs[vertex] = along;
      edges[vertex] = Math.abs(across);
      falls[vertex] = steep;
      paces[vertex] = 1 + steep * (FALL_PACE - 1);
      flow[vertex * 2] = (tangentX / size) * paces[vertex]!;
      flow[vertex * 2 + 1] = (tangentZ / size) * paces[vertex]!;
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
  geometry.setAttribute('streamAcross', new THREE.BufferAttribute(sideways, 1));
  geometry.setAttribute('streamAlong', new THREE.BufferAttribute(alongs, 1));
  geometry.setAttribute('streamEdge', new THREE.BufferAttribute(edges, 1));
  geometry.setAttribute('streamFall', new THREE.BufferAttribute(falls, 1));
  geometry.setAttribute('streamPace', new THREE.BufferAttribute(paces, 1));
  geometry.setAttribute('waterFlow', new THREE.BufferAttribute(flow, 2));
  geometry.setAttribute('waterFlowShare', new THREE.BufferAttribute(flowShare, 1));
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
    builder.add(
      stone,
      stoneGeometry(radius, radius * 0.6, 1400 + index, 0.5, 0),
      placed(x, ground + radius * 0.12, z, { y: random() * Math.PI * 2 }),
    );
  }
  return builder.build();
}
