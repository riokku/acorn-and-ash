import * as THREE from 'three/webgpu';

import { DugGrid, VOXEL, mountainWeight, type Dig, type Terrain } from '@acorn/shared';

import earthLayersUrl from '@assets/textures/dug-earth-layers.png?url';

/**
 * Ground dug out with the shovel, drawn as plain blocks (decision 0114).
 *
 * The hillside itself is a smooth mesh, which cannot have a hole in it. So
 * wherever a dig comes within a metre and a half of the surface, the smooth
 * ground over that square is taken away and the same square is built again
 * out of half-metre blocks, with the dug-out space left empty. Deeper down,
 * only the walls, floor and roof of a tunnel are drawn.
 *
 * The walls wear a texture painted in Blender (tools/art/dug_earth_layers.py):
 * topsoil, then earth with roots and stones, then stone, getting darker with
 * depth. The texture's height is depth below the ground, so the layers line up
 * from one hole to the next, whatever the shape of the dig.
 */

/** The painted strip is this wide (it repeats sideways) and this deep, in metres. */
const TEXTURE_WIDTH = 4;
const TEXTURE_DEPTH = 6;
/** On the mountain the stone starts higher up: depth counts this many times over. */
const ROCK_DEPTH_FACTOR = 1.6;
/** The colours of the three layers as painted on the strip, for floors and roofs. */
const TOPSOIL = new THREE.Color(0x3d2b19);
const EARTH = new THREE.Color(0x6b4b2c);
const STONE = new THREE.Color(0x56565a);

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
  [
    [1, 0, 1],
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 0],
    [0, 0, 1],
    [0, 1, 1],
    [0, 1, 0],
  ],
  [
    [0, 1, 1],
    [1, 1, 1],
    [1, 1, 0],
    [0, 1, 0],
  ],
  [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
    [0, 0, 1],
  ],
  [
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ],
  [
    [1, 0, 0],
    [0, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
  ],
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
  const earthLayers = new THREE.TextureLoader().load(earthLayersUrl);
  earthLayers.colorSpace = THREE.SRGBColorSpace;
  earthLayers.wrapS = THREE.RepeatWrapping;
  earthLayers.wrapT = THREE.ClampToEdgeWrapping;
  earthLayers.anisotropy = 4;
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: earthLayers,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  /** The grass or bare rock that caps a hole's mouth, and tunnel floors and roofs, are flat colours. */
  const capMaterial = new THREE.MeshStandardMaterial({
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

  function isRocky(x: number, z: number): boolean {
    return mountainWeight(x, z) > 0.2 && terrain.heightAt(x, z) > 8;
  }

  /** A little variation per cube so the blocks read as blocks. */
  function cubeShade(ix: number, iy: number, iz: number): number {
    return 0.9 + (((ix * 73856093) ^ (iy * 19349663) ^ (iz * 83492791)) & 15) / 80;
  }

  /** How far down the painted strip a point on a wall is: 1 at the ground, 0 at the bottom of the strip. */
  function stripV(x: number, y: number, z: number, rocky: boolean): number {
    const depth = Math.max(0, terrain.heightAt(x, z) - y) * (rocky ? ROCK_DEPTH_FACTOR : 1);
    return 1 - Math.min(depth, TEXTURE_DEPTH) / TEXTURE_DEPTH;
  }

  /**
   * Floors and roofs are flat colours, the layers' own colours: the strip is a
   * side view, and laid flat it only smears into streaks.
   */
  function layerColor(depth: number, out: THREE.Color): void {
    const blend = (from: number, to: number): number =>
      Math.min(1, Math.max(0, (depth - from) / (to - from)));
    out.copy(TOPSOIL).lerp(EARTH, blend(0.45, 0.75)).lerp(STONE, blend(2.9, 3.2));
    out.multiplyScalar(1 - 0.4 * Math.min(1, depth / TEXTURE_DEPTH));
  }

  function rebuildChunk(chunk: number): void {
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    /** Side walls wearing the painted strip, and the flat-coloured caps, floors and roofs. */
    const wallIndices: number[] = [];
    const capIndices: number[] = [];
    const color = new THREE.Color();
    const chunkCellX = Math.floor(chunk / 8192) - 4096;
    const chunkCellZ = (chunk % 8192) - 4096;
    for (
      let cellX = chunkCellX * CELLS_PER_CHUNK;
      cellX < (chunkCellX + 1) * CELLS_PER_CHUNK;
      cellX++
    ) {
      for (
        let cellZ = chunkCellZ * CELLS_PER_CHUNK;
        cellZ < (chunkCellZ + 1) * CELLS_PER_CHUNK;
        cellZ++
      ) {
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
                const rocky = isRocky((ix + 0.5) * VOXEL, (iz + 0.5) * VOXEL);
                const isCap = face === 2 && !grid.isUnderground(ix, iy + 1, iz);
                const isFlat = isCap || face === 2 || face === 3;
                if (isCap) color.set(rocky ? 0x80838a : 0x5f7a3a);
                else if (isFlat) {
                  const v = stripV(
                    (ix + 0.5) * VOXEL,
                    (iy + 0.5) * VOXEL,
                    (iz + 0.5) * VOXEL,
                    rocky,
                  );
                  layerColor((1 - v) * TEXTURE_DEPTH, color);
                } else color.setScalar(1);
                color.multiplyScalar(cubeShade(ix, iy, iz));
                const base = positions.length / 3;
                for (const corner of FACE_CORNERS[face]!) {
                  const x = (ix + corner[0]) * VOXEL;
                  const y = (iy + corner[1]) * VOXEL;
                  const z = (iz + corner[2]) * VOXEL;
                  positions.push(x, y, z);
                  colors.push(color.r, color.g, color.b);
                  if (face < 2) uvs.push(z / TEXTURE_WIDTH, stripV(x, y, z, rocky));
                  else if (face > 3) uvs.push(x / TEXTURE_WIDTH, stripV(x, y, z, rocky));
                  else uvs.push(0, 0);
                }
                (isFlat ? capIndices : wallIndices).push(
                  base,
                  base + 1,
                  base + 2,
                  base,
                  base + 2,
                  base + 3,
                );
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
    if (wallIndices.length + capIndices.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex([...wallIndices, ...capIndices]);
    geometry.addGroup(0, wallIndices.length, 0);
    geometry.addGroup(wallIndices.length, capIndices.length, 1);
    geometry.computeVertexNormals();
    geometry.computeBoundsTree();
    const mesh = new THREE.Mesh(geometry, [wallMaterial, capMaterial]);
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
      wallMaterial.dispose();
      capMaterial.dispose();
      earthLayers.dispose();
    },
  };
}
