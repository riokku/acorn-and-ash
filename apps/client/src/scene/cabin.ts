import * as THREE from 'three/webgpu';

import { paintedMaterial, plainMaterial } from '../art/materials';
import { ModelBuilder, logGeometry, placed, plankGeometry, stoneGeometry } from '../art/shapes';

/**
 * A little log cabin (see decision 0053): honey-coloured logs notched
 * together at the corners on a low stone footing, a plank door with a
 * doorstep, a window glowing warm from inside with a flower box under it,
 * a shingled roof with plank gables, a fieldstone chimney, and a woodpile
 * stacked along one side.
 *
 * Built in code from painted parts rather than loaded from a file, and kept
 * inside its 3 m footprint and its triangle budget. The door is on the +Z
 * side, which is where its owner wakes up (see `homePositionFor`).
 */
export interface Cabin {
  readonly group: THREE.Group;
  dispose(): void;
}

/** Log centre to log centre, side walls (along X) and front and back walls (along Z). */
const WIDTH = 4;
const DEPTH = 3.6;
const LOG_RADIUS = 0.15;
/** How far each log carries on past the corner it is notched into. */
const OVERHANG = 0.24;
/** Each course sits a little down into the one below, the way notched logs do. */
const COURSE = LOG_RADIUS * 1.86;
const COURSES = 8;
/** The stone footing the lowest logs rest on. */
const FOOTING = 0.2;
const WALL_TOP = FOOTING + COURSE * (COURSES + 0.5) + LOG_RADIUS * 0.6;
const RIDGE = WALL_TOP + 1.45;
/** How much the roof drops for every metre out from the ridge. */
const PITCH = (RIDGE - WALL_TOP) / (DEPTH / 2 + LOG_RADIUS);
const EAVE_FRONT = DEPTH / 2 + 0.6;
const EAVE_BACK = DEPTH / 2 + 0.4;
const ROOF_SIDE = WIDTH / 2 + OVERHANG + 0.2;

/** Openings cut through the front wall: the door, and the window. */
const DOOR = { left: -1.05, right: -0.1, bottom: FOOTING, top: FOOTING + 1.85 };
const WINDOW = { left: 0.75, right: 1.55, bottom: FOOTING + 0.85, top: FOOTING + 1.6 };

export function createCabin(): Cabin {
  const logs = paintedMaterial('wood', { tint: 0xf2e2cc, roughness: 0.85 });
  const logEnds = paintedMaterial('logEnd', { roughness: 0.9 });
  const boards = paintedMaterial('wood', { tint: 0xc9a07a, roughness: 0.9 });
  const doorWood = paintedMaterial('wood', { tint: 0x9f7250, roughness: 0.85 });
  const trim = paintedMaterial('wood', { tint: 0xfff3dc, roughness: 0.8 });
  const shingles = paintedMaterial('shingles', { roughness: 0.95 });
  const cobbles = paintedMaterial('cobbles', { tint: 0xf1e6d6, roughness: 1 });
  const stone = paintedMaterial('stone', { roughness: 1, flatShading: true });
  const soil = paintedMaterial('soil', { roughness: 1 });
  const bark = paintedMaterial('bark', { roughness: 1 });
  // Somebody's home, so the lamp inside is always on: a soft glow by day
  // that reads as a warm window at night.
  const glass = plainMaterial(0xffd79a, {
    roughness: 0.3,
    emissive: 0xffb45c,
    emissiveIntensity: 0.9,
  });
  const iron = plainMaterial(0x2b2622, { roughness: 0.6 });

  const builder = new ModelBuilder();
  let seed = 1;
  const addLog = (
    material: THREE.Material,
    endMaterial: THREE.Material,
    length: number,
    radius: number,
    matrix: THREE.Matrix4,
    ringEvery = 1.2,
  ): void => {
    const { side, ends } = logGeometry(length, radius, {
      sides: 7,
      seed: seed++,
      wobble: 0.05,
      taper: 0.04,
      tile: 0.9,
      ringEvery,
    });
    builder.add(material, side, matrix).add(endMaterial, ends, matrix);
  };

  // The stone footing under the whole cabin.
  builder.add(
    cobbles,
    plankGeometry(WIDTH + 0.1, FOOTING, DEPTH + 0.1, 'x', 0.9, 3),
    placed(0, FOOTING / 2, 0),
  );

  // The walls, course by course. Front and back logs sit half a course lower
  // than the side logs, so each corner is two logs crossing, notched together.
  for (let course = 0; course < COURSES; course++) {
    const lowY = FOOTING + LOG_RADIUS + course * COURSE;
    const highY = lowY + COURSE / 2;
    const span = { from: -WIDTH / 2 - OVERHANG, to: WIDTH / 2 + OVERHANG };
    // Front wall, cut round the door and the window.
    for (const [from, to] of cutAround(span.from, span.to, lowY, [DOOR, WINDOW])) {
      addLog(logs, logEnds, to - from, LOG_RADIUS, placed((from + to) / 2, lowY, DEPTH / 2));
    }
    addLog(logs, logEnds, span.to - span.from, LOG_RADIUS, placed(0, lowY, -DEPTH / 2));
    const sideLength = DEPTH + OVERHANG * 2;
    for (const x of [-WIDTH / 2, WIDTH / 2]) {
      addLog(logs, logEnds, sideLength, LOG_RADIUS, placed(x, highY, 0, { y: Math.PI / 2 }));
    }
  }

  addDoor(builder, { boards: doorWood, frame: boards, iron, stone });
  addWindow(builder, { frame: trim, glass, box: boards, soil });
  addGables(builder, boards);
  addRoof(builder, { shingles, boards, logs, logEnds });
  addChimney(builder, cobbles, stone);
  addWoodpile(builder, bark, logEnds, () => seed++);

  return builder.build();
}

/** The pieces of one log course left once any openings it passes through are cut out. */
function cutAround(
  from: number,
  to: number,
  y: number,
  openings: readonly { left: number; right: number; bottom: number; top: number }[],
): [number, number][] {
  let pieces: [number, number][] = [[from, to]];
  for (const opening of openings) {
    if (y + LOG_RADIUS * 0.5 < opening.bottom || y - LOG_RADIUS * 0.5 > opening.top) continue;
    pieces = pieces.flatMap(([a, b]): [number, number][] => {
      if (opening.right <= a || opening.left >= b) return [[a, b]];
      const kept: [number, number][] = [];
      if (opening.left > a) kept.push([a, opening.left]);
      if (opening.right < b) kept.push([opening.right, b]);
      return kept;
    });
  }
  return pieces.filter(([a, b]) => b - a > 0.05);
}

function addDoor(
  builder: ModelBuilder,
  materials: {
    boards: THREE.Material;
    frame: THREE.Material;
    iron: THREE.Material;
    stone: THREE.Material;
  },
): void {
  const width = DOOR.right - DOOR.left;
  const height = DOOR.top - DOOR.bottom;
  const middle = (DOOR.left + DOOR.right) / 2;
  const face = DEPTH / 2 - 0.02;
  // Five upright boards, each a hair different in width.
  const boardWidth = width / 5;
  for (let i = 0; i < 5; i++) {
    builder.add(
      materials.boards,
      plankGeometry(boardWidth - 0.012, height, 0.05, 'y', 1.2, 40 + i),
      placed(DOOR.left + boardWidth * (i + 0.5), DOOR.bottom + height / 2, face),
    );
  }
  // Two cross battens, and a frame round the opening.
  for (const y of [DOOR.bottom + 0.35, DOOR.top - 0.35]) {
    builder.add(
      materials.boards,
      plankGeometry(width - 0.08, 0.12, 0.04, 'x', 1.2, 50),
      placed(middle, y, face + 0.045),
    );
  }
  for (const x of [DOOR.left - 0.04, DOOR.right + 0.04]) {
    builder.add(
      materials.frame,
      plankGeometry(0.1, height + 0.08, 0.34, 'y', 1.2, 60),
      placed(x, DOOR.bottom + height / 2, DEPTH / 2),
    );
  }
  builder.add(
    materials.frame,
    plankGeometry(width + 0.3, 0.12, 0.36, 'x', 1.2, 61),
    placed(middle, DOOR.top + 0.06, DEPTH / 2),
  );
  // A round iron handle.
  builder.add(
    materials.iron,
    new THREE.TorusGeometry(0.045, 0.012, 5, 10),
    placed(DOOR.right - 0.16, DOOR.bottom + height * 0.5, face + 0.06),
  );
  // A flat doorstep.
  builder.add(
    materials.stone,
    stoneGeometry(0.42, 0.1, 71, 0.6),
    placed(middle, 0, DEPTH / 2 + 0.45, {}, { x: 1.4, y: 1, z: 0.9 }),
  );
}

function addWindow(
  builder: ModelBuilder,
  materials: {
    frame: THREE.Material;
    glass: THREE.Material;
    box: THREE.Material;
    soil: THREE.Material;
  },
): void {
  const width = WINDOW.right - WINDOW.left;
  const height = WINDOW.top - WINDOW.bottom;
  const middleX = (WINDOW.left + WINDOW.right) / 2;
  const middleY = (WINDOW.bottom + WINDOW.top) / 2;
  const face = DEPTH / 2;

  builder.add(
    materials.glass,
    plankGeometry(width, height, 0.02, 'x', 1, 0),
    placed(middleX, middleY, face - 0.06),
  );
  // The frame, and a cross of glazing bars.
  const bar = 0.07;
  builder
    .add(
      materials.frame,
      plankGeometry(width + bar * 2, bar, 0.2, 'x', 1, 80),
      placed(middleX, WINDOW.top + bar / 2, face),
    )
    .add(
      materials.frame,
      plankGeometry(width + bar * 3, bar, 0.26, 'x', 1, 81),
      placed(middleX, WINDOW.bottom - bar / 2, face + 0.02),
    )
    .add(
      materials.frame,
      plankGeometry(bar, height, 0.2, 'y', 1, 82),
      placed(WINDOW.left - bar / 2, middleY, face),
    )
    .add(
      materials.frame,
      plankGeometry(bar, height, 0.2, 'y', 1, 83),
      placed(WINDOW.right + bar / 2, middleY, face),
    )
    .add(
      materials.frame,
      plankGeometry(0.035, height, 0.05, 'y', 1, 84),
      placed(middleX, middleY, face - 0.03),
    )
    .add(
      materials.frame,
      plankGeometry(width, 0.035, 0.05, 'x', 1, 85),
      placed(middleX, middleY, face - 0.03),
    );

  // A flower box under the sill, with a few blooms.
  const boxY = WINDOW.bottom - 0.2;
  const boxZ = face + 0.2;
  builder.add(
    materials.box,
    plankGeometry(width + 0.2, 0.16, 0.22, 'x', 1, 86),
    placed(middleX, boxY, boxZ),
  );
  builder.add(
    materials.soil,
    plankGeometry(width + 0.12, 0.02, 0.16, 'x', 0.5, 87),
    placed(middleX, boxY + 0.075, boxZ),
  );
  const blooms = [0xf2b8c6, 0xf6e27a, 0xffffff, 0xd98fd0, 0xf2b8c6, 0xf6e27a];
  const leaf = plainMaterial(0x5f8f3a, { roughness: 0.8, flatShading: true });
  blooms.forEach((hex, index) => {
    const x = WINDOW.left - 0.02 + (index / (blooms.length - 1)) * (width + 0.04);
    const z = boxZ + (index % 2 === 0 ? -0.03 : 0.04);
    builder.add(
      leaf,
      new THREE.IcosahedronGeometry(0.075, 0),
      placed(x, boxY + 0.12, z, {}, { x: 1, y: 0.7, z: 1 }),
    );
    builder.add(
      plainMaterial(hex, { roughness: 0.6, flatShading: true }),
      new THREE.IcosahedronGeometry(0.045, 0),
      placed(x + 0.02, boxY + 0.19, z + 0.03),
    );
  });
}

/**
 * The triangle of wall under each end of the roof: one panel cut to the
 * roof's slope, grain running upright, with battens over it every so often
 * so it reads as boards.
 */
function addGables(builder: ModelBuilder, boards: THREE.Material): void {
  const bottom = WALL_TOP - 0.1;
  const halfSpan = DEPTH / 2 + LOG_RADIUS;
  const peak = RIDGE - 0.06;
  const shape = new THREE.Shape();
  shape.moveTo(-halfSpan, bottom);
  shape.lineTo(halfSpan, bottom);
  shape.lineTo(0, peak);
  shape.closePath();
  const tile = 1.1;
  for (const x of [-WIDTH / 2, WIDTH / 2]) {
    const panel = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: false });
    const uv = panel.attributes.uv;
    if (uv !== undefined) {
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / tile, uv.getY(i) / tile);
    }
    // Shape X runs along the wall (world Z), shape Y up it, and its
    // thickness out through the wall (world X).
    builder.add(boards, panel, placed(x + (x > 0 ? 0.035 : -0.015), 0, 0, { y: -Math.PI / 2 }));

    const battenSpacing = 0.44;
    for (let z = -halfSpan + battenSpacing; z < halfSpan - 0.1; z += battenSpacing) {
      const top = peak - (Math.abs(z) / halfSpan) * (peak - bottom) - 0.06;
      const height = top - bottom;
      if (height < 0.1) continue;
      builder.add(
        boards,
        plankGeometry(0.04, height, 0.1, 'y', tile, 90 + Math.round(z * 10)),
        placed(x + Math.sign(x) * 0.055, bottom + height / 2, z),
      );
    }
  }
}

function addRoof(
  builder: ModelBuilder,
  materials: {
    shingles: THREE.Material;
    boards: THREE.Material;
    logs: THREE.Material;
    logEnds: THREE.Material;
  },
): void {
  const angle = Math.atan(PITCH);
  const width = ROOF_SIDE * 2;
  for (const side of [1, -1]) {
    const eave = side > 0 ? EAVE_FRONT : EAVE_BACK;
    const run = eave;
    const slope = Math.hypot(run, run * PITCH);
    const middleZ = (side * run) / 2;
    const middleY = RIDGE - (run * PITCH) / 2;
    // The shingles on top, and plain boards underneath where they overhang.
    const lift = new THREE.Vector3(0, Math.cos(angle), side * Math.sin(angle));
    const rotation = { x: side * angle };
    builder.add(
      materials.shingles,
      plankGeometry(width, 0.07, slope, 'z', 1, side > 0 ? 100 : 101),
      placed(0, middleY + lift.y * 0.1, middleZ + lift.z * 0.1, rotation),
    );
    builder.add(
      materials.boards,
      plankGeometry(width - 0.02, 0.06, slope - 0.02, 'x', 1.4, 102),
      placed(0, middleY + lift.y * 0.035, middleZ + lift.z * 0.035, rotation),
    );
  }
  // A log along the ridge, capping where the two sides meet.
  const { side, ends } = logGeometry(width + 0.1, 0.1, {
    sides: 7,
    seed: 110,
    ringEvery: 1.4,
    tile: 0.9,
  });
  builder
    .add(materials.logs, side, placed(0, RIDGE + 0.12, 0))
    .add(materials.logEnds, ends, placed(0, RIDGE + 0.12, 0));
}

/** A fieldstone chimney up the outside of one gable end, a little way back from the front. */
function addChimney(builder: ModelBuilder, cobbles: THREE.Material, stone: THREE.Material): void {
  const x = WIDTH / 2 + 0.36;
  const z = -0.55;
  const lowHeight = WALL_TOP + 0.3;
  builder.add(
    cobbles,
    plankGeometry(0.62, lowHeight, 0.72, 'y', 0.6, 120),
    placed(x, lowHeight / 2, z),
  );
  const stackHeight = RIDGE + 0.7 - lowHeight;
  builder.add(
    cobbles,
    plankGeometry(0.46, stackHeight, 0.5, 'y', 0.6, 121),
    placed(x - 0.04, lowHeight + stackHeight / 2, z),
  );
  // A flat stone cap on top.
  builder.add(
    stone,
    plankGeometry(0.58, 0.07, 0.62, 'x', 0.8, 122),
    placed(x - 0.04, RIDGE + 0.73, z),
  );
}

/** Split logs stacked along the left-hand wall, their cut ends facing out. */
function addWoodpile(
  builder: ModelBuilder,
  bark: THREE.Material,
  logEnds: THREE.Material,
  nextSeed: () => number,
): void {
  const x = -WIDTH / 2 - 0.5;
  const radius = 0.09;
  const rows = [
    { count: 5, y: radius },
    { count: 4, y: radius * 2.7 },
    { count: 3, y: radius * 4.4 },
  ];
  for (const row of rows) {
    for (let i = 0; i < row.count; i++) {
      const z = (i - (row.count - 1) / 2) * radius * 2.05;
      const { side, ends } = logGeometry(0.55, radius * (0.9 + ((i * 7) % 3) * 0.06), {
        sides: 6,
        seed: nextSeed(),
        wobble: 0.08,
        tile: 0.6,
        ringEvery: 1,
      });
      const matrix = placed(x, row.y, z + (row.count % 2 === 0 ? 0 : 0.02));
      builder.add(bark, side, matrix).add(logEnds, ends, matrix);
    }
  }
}
