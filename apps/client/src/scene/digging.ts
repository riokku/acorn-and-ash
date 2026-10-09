import * as THREE from 'three/webgpu';

import { DugGrid, VOXEL, mountainWeight, type Dig, type Terrain } from '@acorn/shared';

/**
 * Ground dug out with the shovel, drawn as plain blocks (decision 0114).
 *
 * The hillside itself is a smooth mesh, which cannot have a hole in it. So
 * wherever a dig comes within a metre and a half of the surface, the smooth
 * ground over that square is taken away and the same square is built again
 * out of half-metre blocks, with the dug-out space left empty. Deeper down,
 * only the walls, floor and roof of a tunnel are drawn. Placeholder art: the
 * real look comes with the Blender pass.
 */

/** How close to the surface a dug cube has to be to cut the smooth ground away. */
const MOUTH_COVER = 1.5;
/** Cubes per side of one ground square: the ground is meshed every 2.5 m. */
const CUBES_PER_CELL = 5;
/** Ground squares per drawn chunk. */
const CELLS_PER_CHUNK = 8;

const FACE_DIRECTIONS = [
  { dx: 1, dy: 0, dz: 0 },
  { dx: -1, dy: 0, dz: 0 },
  { dx: 0, dy: 1, dz: 0 },
  { dx: 0, dy: -1, dz: 0 },
  { dx: 0, dy: 0, dz: 1 },
  { dx: 0, dy: 0, dz: -1 },
] as const;

/** The four corners of each face, counter-clockwise seen from outside, as offsets from the cube's low corner. */
const FACE_CORNERS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]],
  [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]],
  [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]],
  [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
  [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
  [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
];

export interface DigScene {
  readonly group: THREE.Group;
  readonly grid: DugGrid;
  /** Meshes the follow camera must not pass through. */
  readonly cameraBlockers: readonly THREE.Mesh[];
  /** Carve any digs not yet known (ones already applied change nothing), then redraw what changed. */
  apply(digs: readonly Dig[]): void;
  /** How far below the ground above them a body at this spot is, in metres (0 in the open air). */
  depthAt(x: number, z: number, feetY: number): number;
  dispose(): void;
}

/**
 * @param hideGround takes the smooth ground away from the squares given, as
 *   (column, row) numbers in the ground mesh's own grid.
 * @param groundOrigin where the ground mesh's first square starts, on both axes.
 * @param groundCell how wide one ground square is.
 */
export function createDigScene(
  terrain: Terrain,
  ground: {
    readonly origin: number;
    readonly cell: number;
    hide(cellX: number, cellZ: number): void;
  },
): DigScene {
  const grid = new DugGrid(terrain);
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const chunks = new Map<number, THREE.Mesh>();
  const hidden = new Set<number>();
  const dirty = new Set<number>();
  /** Ground squares with dug cubes in them: the ones that need walls drawn. */
  const touched = new Set<number>();

  // The ground's first square starts at `origin` metres, a whole number of cubes.
  const cubesBeforeOrigin = Math.round(-ground.origin / VOXEL);
  const cubesPerCell = Math.round(ground.cell / VOXEL);
  if (cubesPerCell !== CUBES_PER_CELL) throw new Error('ground squares are not five cubes wide');

  const cellOf = (index: number): number => Math.floor((index + cubesBeforeOrigin) / cubesPerCell);
  const cellKey = (cellX: number, cellZ: number): number => (cellX + 4096) * 8192 + (cellZ + 4096);
  const chunkKeyOfCell = (cellX: number, cellZ: number): number =>
    cellKey(Math.floor(cellX / CELLS_PER_CHUNK), Math.floor(cellZ / CELLS_PER_CHUNK));

  const blockers: THREE.Mesh[] = [];

  function noteCube(ix: number, iy: number, iz: number): void {
    const cellX = cellOf(ix);
    const cellZ = cellOf(iz);
    const key = cellKey(cellX, cellZ);
    touched.add(key);
    dirty.add(chunkKeyOfCell(cellX, cellZ));
    const surface = terrain.heightAt((ix + 0.5) * VOXEL, (iz + 0.5) * VOXEL);
    if (surface - (iy + 1) * VOXEL < MOUTH_COVER && !hidden.has(key)) {
      hidden.add(key);
      ground.hide(cellX, cellZ);
    }
  }

  function isSolid(ix: number, iy: number, iz: number): boolean {
    return grid.isSolid(ix, iy, iz);
  }

  function cubeColor(ix: number, iy: number, iz: number, face: number, out: THREE.Color): void {
    const x = (ix + 0.5) * VOXEL;
    const z = (iz + 0.5) * VOXEL;
    const rocky = mountainWeight(x, z) > 0.2 && terrain.heightAt(x, z) > 8;
    const exposedTop = face === 2 && !grid.isUnderground(ix, iy + 1, iz);
    if (exposedTop) out.set(rocky ? 0x80838a : 0x5f7a3a);
    else if (face === 2) out.set(rocky ? 0x6b6e75 : 0x7b6347);
    else if (face === 3) out.set(rocky ? 0x4c4e54 : 0x4f3f2f);
    else out.set(rocky ? 0x5d6066 : 0x68523b);
    // A little variation per cube so the blocks read as blocks.
    const shade = 0.9 + (((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) & 15) / 80;
    out.multiplyScalar(shade);
  }

  function rebuildChunk(chunk: number): void {
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];
    const color = new THREE.Color();
    const chunkCellX = Math.floor(chunk / 8192) - 4096;
    const chunkCellZ = (chunk % 8192) - 4096;
    for (let cellX = chunkCellX * CELLS_PER_CHUNK; cellX < (chunkCellX + 1) * CELLS_PER_CHUNK; cellX++) {
      for (let cellZ = chunkCellZ * CELLS_PER_CHUNK; cellZ < (chunkCellZ + 1) * CELLS_PER_CHUNK; cellZ++) {
        const key = cellKey(cellX, cellZ);
        if (!touched.has(key)) continue;
        const firstX = cellX * cubesPerCell - cubesBeforeOrigin;
        const firstZ = cellZ * cubesPerCell - cubesBeforeOrigin;
        // The layers worth drawing: from just under the lowest dug cube nearby up to the top.
        let lowest = Infinity;
        let highest = -Infinity;
        for (let ix = firstX - 1; ix <= firstX + cubesPerCell; ix++) {
          for (let iz = firstZ - 1; iz <= firstZ + cubesPerCell; iz++) {
            if (!grid.hasColumn(ix, iz)) continue;
            for (let iy = -40; iy < 400; iy++) {
              if (!grid.isDug(ix, iy, iz)) continue;
              lowest = Math.min(lowest, iy);
              highest = Math.max(highest, iy);
            }
          }
        }
        if (lowest === Infinity) continue;
        const isHidden = hidden.has(key);
        for (let ix = firstX; ix < firstX + cubesPerCell; ix++) {
          for (let iz = firstZ; iz < firstZ + cubesPerCell; iz++) {
            const surface = terrain.heightAt((ix + 0.5) * VOXEL, (iz + 0.5) * VOXEL);
            const top = isHidden ? Math.ceil(surface / VOXEL) : highest + 1;
            for (let iy = lowest - 1; iy <= top; iy++) {
              if (!isSolid(ix, iy, iz)) continue;
              for (let face = 0; face < 6; face++) {
                const d = FACE_DIRECTIONS[face]!;
                if (isSolid(ix + d.dx, iy + d.dy, iz + d.dz)) continue;
                // Under smooth ground that is still drawn, only faces into dug space show.
                if (!isHidden && !grid.isDug(ix + d.dx, iy + d.dy, iz + d.dz)) continue;
                cubeColor(ix, iy, iz, face, color);
                const base = positions.length / 3;
                for (const corner of FACE_CORNERS[face]!) {
                  positions.push(
                    (ix + corner[0]) * VOXEL,
                    (iy + corner[1]) * VOXEL,
                    (iz + corner[2]) * VOXEL,
                  );
                  colors.push(color.r, color.g, color.b);
                }
                indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
              }
            }
          }
        }
      }
    }

    const previous = chunks.get(chunk);
    if (previous !== undefined) {
      group.remove(previous);
      previous.geometry.dispose();
      blockers.splice(blockers.indexOf(previous), 1);
      chunks.delete(chunk);
    }
    if (indices.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundsTree();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    chunks.set(chunk, mesh);
    blockers.push(mesh);
  }

  return {
    group,
    grid,
    cameraBlockers: blockers,
    apply(digs) {
      for (const dig of digs) {
        for (const cube of grid.apply(dig)) noteCube(cube.ix, cube.iy, cube.iz);
      }
      for (const chunk of dirty) rebuildChunk(chunk);
      dirty.clear();
    },
    depthAt(x, z, feetY) {
      const surface = terrain.heightAt(x, z);
      return grid.hasColumn(Math.floor(x / VOXEL), Math.floor(z / VOXEL))
        ? Math.max(0, surface - feetY)
        : 0;
    },
    dispose() {
      for (const mesh of chunks.values()) mesh.geometry.dispose();
      chunks.clear();
      material.dispose();
    },
  };
}
