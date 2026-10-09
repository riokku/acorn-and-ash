import * as THREE from 'three/webgpu';

import { DugGrid, VOXEL, mountainWeight, type Dig, type Terrain } from '@acorn/shared';

import earthLayersUrl from '@assets/textures/dug-earth-layers.png?url';

import type { GroundPatches } from './wilderness';

import {
  appendWallPiece,
  dugWallKit,
  planWallPieces,
  preloadDugWalls,
  WALL_CELL,
  type ClosedSides,
} from './dug-walls';

/**
 * Ground dug out with the shovel (decision 0114).
 *
 * The hillside itself is a smooth mesh, which cannot have a hole in it. So
 * wherever a dig comes within a metre and a half of the surface, the smooth
 * ground over that square is taken away and the same square is built again
 * out of half-metre blocks, with the dug-out space left empty. Deeper down,
 * only the walls, floor and roof of a tunnel are drawn.
 *
 * The inside of a hole is lined with smooth, round pieces made in Blender
 * (see dug-walls.ts), picked and turned by which neighbours are solid. Only
 * until those have loaded, or if they ever fail to, the inside is drawn as
 * plain blocks.
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

/**
 * The column of the painted strip (0 to 1 across) with no roots, stones or
 * cracks in it, found by measuring the texture. Floors and roofs read from here
 * so they come out as plain ground instead of smeared streaks.
 */
const PLAIN_COLUMN = 0.619;

/** How far behind the lining the plain faces are set, in metres. */
const BACKING_DEPTH = 0.03;

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

type Point = [number, number, number];

/** The ground over hidden squares, gathered as flat lists until a chunk is ready to draw. */
interface SkinBuffers {
  position: number[];
  normal: number[];
  floor: number[];
  rock: number[];
  snow: number[];
  tint: number[];
  index: number[];
}

export interface DigScene {
  readonly group: THREE.Group;
  readonly grid: DugGrid;
  /** Meshes the follow camera must not pass through. */
  readonly cameraBlockers: readonly THREE.Mesh[];
  /** Carve any digs not yet known (ones already applied change nothing), then redraw what changed. */
  apply(digs: readonly Dig[]): void;
  /** Whether a hole opens to the sky at, or right beside, this spot: no grass should grow there. */
  isOpenNear(x: number, z: number): boolean;
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
export function createDigScene(terrain: Terrain, ground: GroundPatches): DigScene {
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
  });
  /** The grass or bare rock that caps a hole's mouth, and tunnel floors and roofs, are flat colours. */
  const capMaterial = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    flatShading: true,
  });
  const chunks = new Map<number, THREE.Mesh>();
  /** The ground over each chunk's hidden squares, drawn again in the ground's paint with the holes left out. */
  const skins = new Map<number, THREE.Mesh>();
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
    const surface = terrain.heightAt((ix + 0.5) * VOXEL, (iz + 0.5) * VOXEL);
    const nearSurface = surface - (iy + 1) * VOXEL < MOUTH_COVER;
    // The squares touching this cube too: a hole at the edge of a square needs
    // the next one redrawn as well, or its ground has no wall facing the hole.
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const cellX = cellOf(ix + dx);
        const cellZ = cellOf(iz + dz);
        const key = cellKey(cellX, cellZ);
        touched.add(key);
        dirty.add(chunkKeyOfCell(cellX, cellZ));
        if (nearSurface && !hidden.has(key)) {
          hidden.add(key);
          ground.hide(cellX, cellZ);
        }
      }
    }
  }

  function isSolid(ix: number, iy: number, iz: number): boolean {
    return grid.isSolid(ix, iy, iz);
  }

  /** Whether a dug column reaches the open air: here the ground is a hole, not a roof. */
  function isOpenColumn(ix: number, iz: number): boolean {
    if (!grid.hasColumn(ix, iz)) return false;
    for (let iy = -40; iy < 400; iy++) {
      if (grid.isDug(ix, iy, iz) && !grid.isUnderground(ix, iy + 1, iz)) return true;
    }
    return false;
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

  /**
   * Whole repeats of the strip taken off a cell's picture, so that across one
   * cell the sideways position stays near the plain column and the slide from
   * wall to floor is short. The strip repeats, so a whole turn changes nothing.
   */
  let pictureShift = 0;

  /**
   * Where a point of the lining sits on the painted strip: side walls read the
   * strip as it is (depth down, along the wall across), while floors and roofs
   * slide over to the plain column so they do not streak.
   */
  function liningPicture(
    x: number,
    y: number,
    z: number,
    normalY: number,
    out: [number, number],
  ): [number, number] {
    const v = stripV(x, y, z, isRocky(x, z));
    const flatness = THREE.MathUtils.smoothstep(Math.abs(normalY), 0.5, 0.85);
    out[0] = THREE.MathUtils.lerp((x + z) / TEXTURE_WIDTH - pictureShift, PLAIN_COLUMN, flatness);
    out[1] = v;
    return out;
  }

  /** How many smaller squares a ground square is cut into along each side: one per half metre. */
  const SKIN_STEPS = CUBES_PER_CELL;
  /** How far the dark rim of a hole reaches down from the surface, in metres. */
  const RIM_DEPTH = 0.6;

  /**
   * The ground over one hidden square, drawn again exactly where it was, in
   * half-metre squares, leaving out the ones over an open hole. A dark rim
   * hangs down from the cut edge so there is never a gap between the grass
   * and the wall of the hole.
   */
  function addSkin(
    cellX: number,
    cellZ: number,
    firstX: number,
    firstZ: number,
    skin: SkinBuffers,
    rim: { positions: number[]; normals: number[]; uvs: number[]; colors: number[] },
    rimIndices: number[],
  ): void {
    const lattice = ground.lattice?.(cellX, cellZ, SKIN_STEPS);
    if (lattice === null || lattice === undefined) return;
    const side = SKIN_STEPS + 1;
    const base = skin.position.length / 3;
    for (let i = 0; i < side * side; i++) {
      skin.position.push(
        lattice.position[i * 3]!,
        lattice.position[i * 3 + 1]!,
        lattice.position[i * 3 + 2]!,
      );
      skin.normal.push(
        lattice.normal[i * 3]!,
        lattice.normal[i * 3 + 1]!,
        lattice.normal[i * 3 + 2]!,
      );
      skin.floor.push(lattice.floor[i]!);
      skin.rock.push(lattice.rock[i]!);
      skin.snow.push(lattice.snow[i]!);
      skin.tint.push(lattice.tint[i * 3]!, lattice.tint[i * 3 + 1]!, lattice.tint[i * 3 + 2]!);
    }
    const point = (i: number, j: number): Point => {
      const at = (j * side + i) * 3;
      return [lattice.position[at]!, lattice.position[at + 1]!, lattice.position[at + 2]!];
    };
    const rimColor = TOPSOIL.clone().multiplyScalar(0.85);
    /** A flat strip hanging from the skin's cut edge, facing into the hole. */
    const hang = (top0: Point, top1: Point, facingX: number, facingZ: number): void => {
      const corners: Point[] = [
        top0,
        top1,
        [top1[0], top1[1] - RIM_DEPTH, top1[2]],
        [top0[0], top0[1] - RIM_DEPTH, top0[2]],
      ];
      // Wound so the face looks the way the hole is, whichever way round the edge was given.
      const e1 = [top1[0] - top0[0], top1[1] - top0[1], top1[2] - top0[2]] as const;
      const e2 = [
        corners[2]![0] - top0[0],
        corners[2]![1] - top0[1],
        corners[2]![2] - top0[2],
      ] as const;
      const nx = e1[1] * e2[2] - e1[2] * e2[1];
      const nz = e1[0] * e2[1] - e1[1] * e2[0];
      const order = nx * facingX + nz * facingZ >= 0 ? [0, 1, 2, 3] : [1, 0, 3, 2];
      const first = rim.positions.length / 3;
      for (const corner of order) {
        const c = corners[corner]!;
        rim.positions.push(c[0], c[1], c[2]);
        rim.normals.push(facingX, 0, facingZ);
        rim.colors.push(rimColor.r, rimColor.g, rimColor.b);
        rim.uvs.push(0, 0);
      }
      rimIndices.push(first, first + 1, first + 2, first, first + 2, first + 3);
    };
    for (let j = 0; j < SKIN_STEPS; j++) {
      for (let i = 0; i < SKIN_STEPS; i++) {
        const ix = firstX + i;
        const iz = firstZ + j;
        if (isOpenColumn(ix, iz)) continue;
        const p00 = j * side + i;
        const p10 = p00 + 1;
        const p01 = p00 + side;
        const p11 = p01 + 1;
        skin.index.push(base + p00, base + p01, base + p10, base + p01, base + p11, base + p10);
        if (isOpenColumn(ix + 1, iz)) hang(point(i + 1, j), point(i + 1, j + 1), 1, 0);
        if (isOpenColumn(ix - 1, iz)) hang(point(i, j), point(i, j + 1), -1, 0);
        if (isOpenColumn(ix, iz + 1)) hang(point(i, j + 1), point(i + 1, j + 1), 0, 1);
        if (isOpenColumn(ix, iz - 1)) hang(point(i, j), point(i + 1, j), 0, -1);
      }
    }
  }

  function rebuildChunk(chunk: number): void {
    const positions: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    const normals: number[] = [];
    const kit = dugWallKit();
    /** Side walls wearing the painted strip, and the flat-coloured caps, floors and roofs. */
    const wallIndices: number[] = [];
    const capIndices: number[] = [];
    const liningIndices: number[] = [];
    const buffers = { positions, normals, uvs, colors, indices: liningIndices };
    const skin: SkinBuffers = {
      position: [],
      normal: [],
      floor: [],
      rock: [],
      snow: [],
      tint: [],
      index: [],
    };
    const withSkin = ground.lattice !== undefined && ground.material !== undefined;
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
                const intoDug = grid.isDug(ix + d.dx, iy + d.dy, iz + d.dz);
                // Faces into open sky are the old blocky ground: the smooth skin covers it.
                if (withSkin && !intoDug && !grid.isUnderground(ix + d.dx, iy + d.dy, iz + d.dz))
                  continue;
                // The smooth lining takes over every face into dug space, but is rounded, so
                // the corners behind it need something to look at: the same face, set a
                // little back so it never fights the flat pieces of the lining.
                const behindLining = kit !== null && intoDug;
                const setBack = behindLining ? BACKING_DEPTH : 0;
                // Under smooth ground that is still drawn, only faces into dug space show.
                if (!isHidden && !intoDug) continue;
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
                  const x = (ix + corner[0]) * VOXEL - d.dx * setBack;
                  const y = (iy + corner[1]) * VOXEL - d.dy * setBack;
                  const z = (iz + corner[2]) * VOXEL - d.dz * setBack;
                  positions.push(x, y, z);
                  normals.push(d.dx, d.dy, d.dz);
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
        if (withSkin && isHidden) addSkin(cellX, cellZ, firstX, firstZ, skin, buffers, capIndices);
        if (kit === null) continue;
        // The smooth lining: a piece for every open cube that touches solid ground.
        for (let ix = firstX; ix < firstX + cubesPerCell; ix++) {
          for (let iz = firstZ; iz < firstZ + cubesPerCell; iz++) {
            for (let iy = lowest; iy <= highest; iy++) {
              if (!grid.isDug(ix, iy, iz)) continue;
              const closed: ClosedSides = [
                [isSolid(ix - 1, iy, iz), isSolid(ix + 1, iy, iz)],
                [isSolid(ix, iy - 1, iz), isSolid(ix, iy + 1, iz)],
                [isSolid(ix, iy, iz - 1), isSolid(ix, iy, iz + 1)],
              ];
              pictureShift = Math.round(((ix + iz + 1) * VOXEL) / TEXTURE_WIDTH - PLAIN_COLUMN);
              for (const plan of planWallPieces(closed)) {
                const piece = kit.pieces.get(plan.piece);
                if (piece === undefined) continue;
                appendWallPiece(
                  piece,
                  plan,
                  [ix * WALL_CELL, iy * WALL_CELL, iz * WALL_CELL],
                  buffers,
                  liningPicture,
                );
              }
            }
          }
        }
      }
    }

    const previousSkin = skins.get(chunk);
    if (previousSkin !== undefined) {
      group.remove(previousSkin);
      previousSkin.geometry.dispose();
      skins.delete(chunk);
    }
    if (skin.index.length > 0 && ground.material !== undefined) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(skin.position, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(skin.normal, 3));
      geometry.setAttribute('floor', new THREE.Float32BufferAttribute(skin.floor, 1));
      geometry.setAttribute('rock', new THREE.Float32BufferAttribute(skin.rock, 1));
      geometry.setAttribute('snow', new THREE.Float32BufferAttribute(skin.snow, 1));
      geometry.setAttribute('tint', new THREE.Float32BufferAttribute(skin.tint, 3));
      geometry.setIndex(skin.index);
      const mesh = new THREE.Mesh(geometry, ground.material);
      mesh.receiveShadow = true;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
      skins.set(chunk, mesh);
    }

    const previous = chunks.get(chunk);
    if (previous !== undefined) {
      group.remove(previous);
      previous.geometry.dispose();
      blockers.splice(blockers.indexOf(previous), 1);
      chunks.delete(chunk);
    }
    wallIndices.push(...liningIndices);
    if (wallIndices.length + capIndices.length === 0) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setIndex([...wallIndices, ...capIndices]);
    geometry.addGroup(0, wallIndices.length, 0);
    geometry.addGroup(wallIndices.length, capIndices.length, 1);
    geometry.computeBoundsTree();
    const mesh = new THREE.Mesh(geometry, [wallMaterial, capMaterial]);
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    group.add(mesh);
    chunks.set(chunk, mesh);
    blockers.push(mesh);
  }

  let disposed = false;
  // Holes dug before the lining pieces arrive are drawn as blocks, then redrawn.
  if (dugWallKit() === null) {
    void preloadDugWalls().then(() => {
      if (disposed) return;
      for (const key of touched) {
        const cellX = Math.floor(key / 8192) - 4096;
        const cellZ = (key % 8192) - 4096;
        dirty.add(chunkKeyOfCell(cellX, cellZ));
      }
      for (const chunk of dirty) rebuildChunk(chunk);
      dirty.clear();
    });
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
    isOpenNear(x, z) {
      const ix = Math.floor(x / VOXEL);
      const iz = Math.floor(z / VOXEL);
      for (let dx = -1; dx <= 1; dx++)
        for (let dz = -1; dz <= 1; dz++) if (isOpenColumn(ix + dx, iz + dz)) return true;
      return false;
    },
    depthAt(x, z, feetY) {
      const surface = terrain.heightAt(x, z);
      return grid.hasColumn(Math.floor(x / VOXEL), Math.floor(z / VOXEL))
        ? Math.max(0, surface - feetY)
        : 0;
    },
    dispose() {
      disposed = true;
      for (const mesh of chunks.values()) mesh.geometry.dispose();
      chunks.clear();
      for (const mesh of skins.values()) mesh.geometry.dispose();
      skins.clear();
      wallMaterial.dispose();
      capMaterial.dispose();
      earthLayers.dispose();
    },
  };
}
