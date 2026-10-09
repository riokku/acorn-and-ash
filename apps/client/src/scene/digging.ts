import * as THREE from 'three/webgpu';

import { DugGrid, VOXEL, mountainWeight, type Dig, type Terrain } from '@acorn/shared';

import earthLayersUrl from '@assets/textures/dug-earth-layers.png?url';

import { roundedMouth, softEdge } from './dug-mouth';
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
    // A faint glow of its own, so the inside of a hole is dark earth at night rather than black.
    emissive: new THREE.Color(0xffffff),
    emissiveMap: earthLayers,
    emissiveIntensity: 0.12,
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
  const openColumns = new Map<number, boolean>();
  function isOpenColumn(ix: number, iz: number): boolean {
    if (!grid.hasColumn(ix, iz)) return false;
    const key = (ix + 4096) * 8192 + (iz + 4096);
    const known = openColumns.get(key);
    if (known !== undefined) return known;
    let open = false;
    for (let iy = -40; iy < 400 && !open; iy++)
      open = grid.isDug(ix, iy, iz) && !grid.isUnderground(ix, iy + 1, iz);
    openColumns.set(key, open);
    return open;
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

  /** How many smaller squares a ground square is cut into along each side: one per 5 cm. */
  const SKIN_STEPS = 50;
  /** Samples of ground looked at beyond a square's own, so a mouth that crosses into the next one is seen whole. */
  const SKIN_MARGIN = 30;
  /** How high the heap of dirt round a mouth is piled at its lip, in metres. */
  const MOUND_HEIGHT = 0.22;
  /** How far the ground curves down into the mouth before it is cut away, in metres. */
  const MOUTH_SINK = 0.7;
  /** What the ground's tint is pulled towards under the heap, so it reads as turned earth. */
  const DIRT_TINT = [0.78, 0.58, 0.4] as const;
  const CLOD_COLOR = new THREE.Color(0x8a5e36);

  /** A unit icosahedron: the corners, and the corners of each of its twenty faces. */
  const GOLDEN = (1 + Math.sqrt(5)) / 2;
  const CLOD_CORNERS = [
    [-1, GOLDEN, 0],
    [1, GOLDEN, 0],
    [-1, -GOLDEN, 0],
    [1, -GOLDEN, 0],
    [0, -1, GOLDEN],
    [0, 1, GOLDEN],
    [0, -1, -GOLDEN],
    [0, 1, -GOLDEN],
    [GOLDEN, 0, -1],
    [GOLDEN, 0, 1],
    [-GOLDEN, 0, -1],
    [-GOLDEN, 0, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x!, y!, z!).normalize());
  const CLOD_FACES = [
    [0, 11, 5],
    [0, 5, 1],
    [0, 1, 7],
    [0, 7, 10],
    [0, 10, 11],
    [1, 5, 9],
    [5, 11, 4],
    [11, 10, 2],
    [10, 7, 6],
    [7, 1, 8],
    [3, 9, 4],
    [3, 4, 2],
    [3, 2, 6],
    [3, 6, 8],
    [3, 8, 9],
    [4, 9, 5],
    [2, 4, 11],
    [6, 2, 10],
    [8, 6, 7],
    [9, 8, 1],
  ] as const;

  /** A repeatable number from 0 up to 1 for these four whole numbers. */
  function scatter(a: number, b: number, c: number, d: number): number {
    let h = Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791);
    h = Math.imul(h ^ (h >>> 13), 1274126177) ^ Math.imul(d, 668265263);
    h = Math.imul(h ^ (h >>> 16), 2246822519);
    return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
  }

  /**
   * The ground over one hidden square, drawn again exactly where it was, in
   * 5 cm squares, with a round hole left in it where the dug ground opens to
   * the sky. Dirt is heaped round the lip, a dark rim hangs down from the cut
   * edge so there is never a gap between the grass and the wall of the hole,
   * and a few clods of earth lie about the heap.
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
    const n = SKIN_STEPS;
    const side = n + 1;
    const step = ground.cell / n;
    const size = n + SKIN_MARGIN * 2;

    // Where the dug ground is open to the sky, sample by sample, seen a little past this square.
    const open = new Uint8Array(size * size);
    let anyOpen = false;
    const samplesPerCube = Math.round(VOXEL / step);
    for (let b = 0; b < size; b++) {
      const iz = firstZ + Math.floor((b - SKIN_MARGIN) / samplesPerCube);
      for (let a = 0; a < size; a++) {
        const ix = firstX + Math.floor((a - SKIN_MARGIN) / samplesPerCube);
        if (isOpenColumn(ix, iz)) {
          open[b * size + a] = 1;
          anyOpen = true;
        }
      }
    }
    const mouth = anyOpen ? roundedMouth(open, size) : null;
    const soft = mouth === null ? null : softEdge(mouth, size);

    // The heap of dirt: raised and browned by how near each corner is to the lip.
    const heap = new Float32Array(side * side);
    const earth = new Float32Array(side * side);
    const nearMouth = new Float32Array(side * side);
    if (soft !== null) {
      for (let j = 0; j < side; j++) {
        for (let i = 0; i < side; i++) {
          let near = 0;
          for (let db = -1; db <= 0; db++)
            for (let da = -1; da <= 0; da++) {
              const a = Math.min(size - 1, Math.max(0, i + SKIN_MARGIN + da));
              const b = Math.min(size - 1, Math.max(0, j + SKIN_MARGIN + db));
              near += soft[b * size + a]! / 4;
            }
          // Up into a heap at the lip, then curving away down into the hole.
          heap[j * side + i] =
            MOUND_HEIGHT * THREE.MathUtils.smoothstep(near, 0.04, 0.4) -
            (MOUND_HEIGHT + MOUTH_SINK) * THREE.MathUtils.smoothstep(near, 0.45, 0.78);
          earth[j * side + i] = THREE.MathUtils.smoothstep(near, 0.02, 0.3);
          nearMouth[j * side + i] = near;
        }
      }
      for (let j = 0; j < side; j++) {
        for (let i = 0; i < side; i++) {
          const at = j * side + i;
          const lean = (u: number, v: number): number =>
            heap[Math.min(side - 1, v) * side + Math.min(side - 1, u)]!;
          const slopeX = (lean(i + 1, j) - lean(Math.max(0, i - 1), j)) / (2 * step);
          const slopeZ = (lean(i, j + 1) - lean(i, Math.max(0, j - 1))) / (2 * step);
          lattice.position[at * 3 + 1]! += heap[at]!;
          const nx = lattice.normal[at * 3]! - slopeX;
          const ny = lattice.normal[at * 3 + 1]!;
          const nz = lattice.normal[at * 3 + 2]! - slopeZ;
          const length = Math.hypot(nx, ny, nz) || 1;
          lattice.normal[at * 3] = nx / length;
          lattice.normal[at * 3 + 1] = ny / length;
          lattice.normal[at * 3 + 2] = nz / length;
          const dirt = earth[at]!;
          lattice.floor[at] = THREE.MathUtils.lerp(lattice.floor[at]!, 1, dirt);
          lattice.snow[at] = lattice.snow[at]! * (1 - dirt);
          for (let axis = 0; axis < 3; axis++)
            lattice.tint[at * 3 + axis] = THREE.MathUtils.lerp(
              lattice.tint[at * 3 + axis]!,
              DIRT_TINT[axis]!,
              dirt,
            );
        }
      }
    }

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
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const p00 = j * side + i;
        const p10 = p00 + 1;
        const p01 = p00 + side;
        const p11 = p01 + 1;
        // Cut away only where the ground has curved well down into the hole.
        if (
          mouth !== null &&
          Math.min(nearMouth[p00]!, nearMouth[p10]!, nearMouth[p01]!, nearMouth[p11]!) >= 0.78
        )
          continue;
        skin.index.push(base + p00, base + p01, base + p10, base + p01, base + p11, base + p10);
      }
    }

    // Clods of earth lying on the heap: small rough lumps, flat-shaded.
    if (soft !== null) {
      const colour = new THREE.Color();
      for (let j = 1; j < n; j++) {
        for (let i = 1; i < n; i++) {
          const at = j * side + i;
          const near = nearMouth[at]!;
          if (near < 0.08 || near > 0.42) continue;
          if (scatter(cellX, cellZ, i, j) > 0.022) continue;
          const big = scatter(cellX, cellZ, i + 7919, j) < 0.25;
          const radius =
            (big ? 0.09 : 0.045) + scatter(cellX, cellZ, i, j + 104729) * (big ? 0.07 : 0.045);
          const turn = scatter(cellX, cellZ, i + 31, j + 17) * Math.PI * 2;
          const squash = 0.6 + scatter(cellX, cellZ, i + 3, j + 5) * 0.3;
          const shade = 0.7 + scatter(cellX, cellZ, i + 11, j + 13) * 0.5;
          colour.copy(CLOD_COLOR).multiplyScalar(shade);
          const [x, y, z] = point(i, j);
          const cos = Math.cos(turn);
          const sin = Math.sin(turn);
          const corner = (index: number): Point => {
            const c = CLOD_CORNERS[index]!;
            const lx = c.x * radius * (1 + 0.25 * Math.sin(index * 5.3 + turn));
            const ly = c.y * radius * squash;
            const lz = c.z * radius * (1 + 0.25 * Math.cos(index * 3.7 + turn));
            return [
              x + lx * cos - lz * sin,
              y + radius * squash * 0.4 + ly,
              z + lx * sin + lz * cos,
            ];
          };
          for (const face of CLOD_FACES) {
            const [p, q, r] = [corner(face[0]), corner(face[1]), corner(face[2])];
            const ux = q[0] - p[0];
            const uy = q[1] - p[1];
            const uz = q[2] - p[2];
            const vx = r[0] - p[0];
            const vy = r[1] - p[1];
            const vz = r[2] - p[2];
            let fx = uy * vz - uz * vy;
            let fy = uz * vx - ux * vz;
            let fz = ux * vy - uy * vx;
            const length = Math.hypot(fx, fy, fz) || 1;
            fx /= length;
            fy /= length;
            fz /= length;
            const first = rim.positions.length / 3;
            for (const c of [p, q, r]) {
              rim.positions.push(c[0], c[1], c[2]);
              rim.normals.push(fx, fy, fz);
              rim.colors.push(colour.r, colour.g, colour.b);
              rim.uvs.push(0, 0);
            }
            rimIndices.push(first, first + 1, first + 2);
          }
        }
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
      openColumns.clear();
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
