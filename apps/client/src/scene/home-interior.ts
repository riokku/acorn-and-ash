import * as THREE from 'three/webgpu';
import { createHomeFacilities } from './home-facilities';
import type { GardenPlot } from '@acorn/shared';

import { HOME_FURNITURE, HOME_ROOM, homeRoomScale, type HomeKind } from '@acorn/shared';

import { paintedMaterial, plainMaterial } from '../art/materials';
import { seededRandom } from '../art/noise';
import { ModelBuilder, logGeometry, placed, plankGeometry, stoneGeometry } from '../art/shapes';
import { createCanvasMaterial, fabricTriangle } from './shelter';
import { flameModelTemplate } from './campfire-models';
import { createFireGlow } from './fire-light';
import { ellipsoid } from './critter';
import { instantiateAnimatedModel } from './model-loading';

/**
 * The room inside every cabin (see decision 0055), built in code from the
 * same painted logs, planks and stones as the cabin outside, laid out by the
 * shared `HOME_ROOM` and `HOME_FURNITURE` so what you see is exactly what you
 * bump into.
 *
 * Seen like a dollhouse: whichever walls stand between the camera and the
 * room are cut down to their bottom log (`cutAway`), so the room is always in
 * full view. Warm by the hearth, and by the lamp on the table, and brighter
 * still at night when the windows go dark.
 */
export interface HomeInterior {
  readonly group: THREE.Group;
  readonly chest: THREE.Group;
  readonly garden: THREE.Group;
  setGardenPlots(plots: readonly GardenPlot[]): void;
  setChestOpen(open: boolean): void;
  /** Cut down whichever walls the camera, at this spot in the room's own coordinates, is looking in through. */
  cutAway(cameraX: number, cameraZ: number): void;
  /** Firelight, lamplight and the windows; `daylight` runs from 0 (midnight) to 1 (noon). */
  update(deltaSeconds: number, daylight: number): void;
  dispose(): void;
}

const LOG_RADIUS = 0.16;
/** One course of logs to the next, each sitting a little down into the one below. */
const COURSE = 0.3;
const DOOR_TOP = 2.05;
/** Where the one ceiling beam runs, across the back of the room. */
const HERB_BEAM_Z = -2.2;

/** The four walls, by which way they face out of the room. */
type WallSide = 'back' | 'front' | 'left' | 'right';
const WALL_NORMALS: Record<WallSide, { x: number; z: number }> = {
  back: { x: 0, z: -1 },
  front: { x: 0, z: 1 },
  left: { x: -1, z: 0 },
  right: { x: 1, z: 0 },
};
/**
 * How far round towards a wall the camera has to be looking in from for it to
 * be cut down, as the cosine of the angle between the wall's own outward
 * facing and the way to the camera.
 */
const CUTAWAY_COSINE = 0.3;

/** A gap in a wall: a span along it, between two heights. */
interface Opening {
  readonly from: number;
  readonly to: number;
  readonly bottom: number;
  readonly top: number;
}

export function createHomeInterior(kind: HomeKind = 'cabin'): HomeInterior {
  const canvasHome = kind === 'tent' || kind === 'teepee';
  const group = new THREE.Group();
  group.name = 'home-interior';
  const scale = homeRoomScale(kind);
  group.scale.set(scale, 1, scale);
  const disposers: Array<() => void> = [];
  const keep = (built: { group: THREE.Group; dispose(): void }): THREE.Group => {
    disposers.push(built.dispose);
    return built.group;
  };
  const facilities = createHomeFacilities(kind);
  group.add(keep(facilities));

  const materials = {
    logs: paintedMaterial('wood', { tint: 0xf0dcc0, roughness: 0.85 }),
    logEnds: paintedMaterial('logEnd', { roughness: 0.9 }),
    chinking: plainMaterial(0xcdb998, { roughness: 1 }),
    floor: paintedMaterial('wood', { tint: 0xd7ad82, roughness: 0.8 }),
    darkWood: paintedMaterial('wood', { tint: 0x8f6444, roughness: 0.8 }),
    trim: paintedMaterial('wood', { tint: 0xfff0d6, roughness: 0.8 }),
    cobbles: paintedMaterial('cobbles', { tint: 0xece0cf, roughness: 1 }),
    stone: paintedMaterial('stone', { roughness: 1, flatShading: true }),
    soot: plainMaterial(0x2b2420, { roughness: 1 }),
    bark: paintedMaterial('bark', { roughness: 1 }),
    linen: paintedMaterial('burlap', { tint: 0xfbf4e4, roughness: 1 }),
    quilt: paintedMaterial('quilt', { roughness: 0.95 }),
    rug: paintedMaterial('rug', { roughness: 1 }),
    brass: plainMaterial(0xb68a3e, { roughness: 0.35 }),
    iron: plainMaterial(0x3b3733, { roughness: 0.55 }),
    lampGlass: plainMaterial(0xfff0c8, {
      roughness: 0.2,
      emissive: 0xffc46a,
      emissiveIntensity: 1.4,
    }),
    herbGreen: plainMaterial(0x6f8a4f, { roughness: 1, flatShading: true }),
    herbLavender: plainMaterial(0x8d77a8, { roughness: 1, flatShading: true }),
    herbYarrow: plainMaterial(0xe8dcae, { roughness: 1, flatShading: true }),
    string: plainMaterial(0xcdb68c, { roughness: 1 }),
  };
  const windowGlass = new THREE.MeshStandardMaterial({
    color: 0xcfe4f2,
    roughness: 0.15,
    emissive: new THREE.Color(0xdcecff),
    emissiveIntensity: 0.9,
  });
  disposers.push(() => windowGlass.dispose());

  const { halfWidth, halfDepth, wallHeight, doorX, doorHalfWidth } = HOME_ROOM;
  const courses = Math.round(wallHeight / COURSE);

  /* -------------------------------------------------------------------- */
  /* Walls                                                                */
  /* -------------------------------------------------------------------- */

  const walls = new Map<WallSide, { low: THREE.Group; high: THREE.Group }>();
  const addWall = (side: WallSide, length: number, openings: readonly Opening[]): void => {
    const low = new ModelBuilder();
    const high = new ModelBuilder();
    let seed = side.length * 101;
    for (let course = 0; course < courses; course++) {
      const y = LOG_RADIUS + course * COURSE;
      // Where this course is broken by a door or a window.
      const gaps = openings.filter(
        (opening) => y + LOG_RADIUS > opening.bottom && y - LOG_RADIUS < opening.top,
      );
      const spans: [number, number][] = [];
      let start = -length / 2 - 0.12;
      for (const gap of [...gaps].sort((a, b) => a.from - b.from)) {
        if (gap.from > start) spans.push([start, gap.from]);
        start = gap.to;
      }
      spans.push([start, length / 2 + 0.12]);
      for (const [from, to] of spans) {
        const span = to - from;
        if (span < 0.08) continue;
        const log = logGeometry(span, LOG_RADIUS * (0.95 + ((course * 7) % 3) * 0.03), {
          sides: 10,
          seed: seed++,
          wobble: 0.05,
          taper: 0.04,
          tile: 0.9,
          ringEvery: 0.9,
        });
        const matrix = placed((from + to) / 2, y, 0);
        const into = course === 0 ? low : high;
        into.add(materials.logs, log.side, matrix).add(materials.logEnds, log.ends, matrix);
      }
    }
    // Chinking behind the logs, so no light shows between courses.
    high.add(
      materials.chinking,
      new THREE.BoxGeometry(length + 0.2, wallHeight - 0.2, 0.04),
      placed(0, wallHeight / 2 + 0.1, LOG_RADIUS * 0.8),
    );
    const lowGroup = keep(low.build());
    const highGroup = keep(high.build());
    // Chinking would show through a window: cut it away there by leaving it
    // out of the wall entirely would take more triangles than a pane of
    // glass in front of it does, so the window's own frame and glass sit in
    // the gap instead (see `addWindow`).
    const wall = new THREE.Group();
    wall.add(lowGroup, highGroup);
    placeWall(wall, side);
    group.add(wall);
    walls.set(side, { low: lowGroup, high: highGroup });
    if (canvasHome) {
      for (const child of [...lowGroup.children, ...highGroup.children]) child.visible = false;
      const extent = side === 'back' || side === 'front' ? halfDepth : halfWidth;
      const top = kind === 'teepee' ? 3.5 : wallHeight;
      const cloth = createCanvasMaterial(kind === 'tent' ? 'tent' : 'teepee');
      disposers.push(() => cloth.dispose());
      const skirt = new ModelBuilder();
      const spans =
        side === 'front'
          ? [
              [-length / 2, doorX - doorHalfWidth],
              [doorX + doorHalfWidth, length / 2],
            ]
          : [[-length / 2, length / 2]];
      for (const [from, to] of spans) {
        skirt.add(
          cloth,
          new THREE.PlaneGeometry(to! - from!, 0.7),
          placed((from! + to!) / 2, 0.35, 0),
        );
        skirt.add(
          materials.darkWood,
          new THREE.CylinderGeometry(0.04, 0.05, 1.1, 6),
          placed(from!, 0.55, 0),
        );
      }
      lowGroup.add(keep(skirt.build()));
      const panels = new ModelBuilder();
      if (kind === 'tent' && (side === 'left' || side === 'right')) {
        panels.add(
          cloth,
          fabricTriangle([-length / 2, 0.05, 0], [length / 2, 0.05, 0], [length / 2, top, -extent]),
        );
        panels.add(
          cloth,
          fabricTriangle(
            [-length / 2, 0.05, 0],
            [length / 2, top, -extent],
            [-length / 2, top, -extent],
          ),
        );
      } else if (side === 'front') {
        // Folded canvas flaps, with an open doorway matching the exit trigger.
        panels.add(
          cloth,
          fabricTriangle(
            [-length / 2, 0.05, 0],
            [doorX - doorHalfWidth, 0.05, 0],
            [0, top, -extent],
          ),
        );
        panels.add(
          cloth,
          fabricTriangle(
            [doorX + doorHalfWidth, 0.05, 0],
            [length / 2, 0.05, 0],
            [0, top, -extent],
          ),
        );
      } else {
        panels.add(
          cloth,
          fabricTriangle(
            [-length / 2, 0.05, 0],
            [length / 2, 0.05, 0],
            [0, top, kind === 'teepee' ? -extent : 0],
          ),
        );
      }
      highGroup.add(keep(panels.build()));
    }
  };

  /** Stand a wall built along X up along its own side of the room, logs facing in. */
  const placeWall = (wall: THREE.Group, side: WallSide): void => {
    const out = LOG_RADIUS;
    switch (side) {
      case 'back':
        wall.position.set(0, 0, -halfDepth - out);
        wall.rotation.y = Math.PI;
        break;
      case 'front':
        wall.position.set(0, 0, halfDepth + out);
        break;
      case 'left':
        wall.position.set(-halfWidth - out, 0, 0);
        wall.rotation.y = -Math.PI / 2;
        break;
      case 'right':
        wall.position.set(halfWidth + out, 0, 0);
        wall.rotation.y = Math.PI / 2;
        break;
    }
  };

  const { sideWindow, backWindow } = HOME_ROOM;
  addWall('back', halfWidth * 2 + LOG_RADIUS * 2, [
    // Seen from outside the back wall's own +X runs the other way round.
    {
      from: -backWindow.x - backWindow.halfWidth,
      to: -backWindow.x + backWindow.halfWidth,
      bottom: backWindow.bottom,
      top: backWindow.top,
    },
  ]);
  addWall('front', halfWidth * 2 + LOG_RADIUS * 2, [
    { from: doorX - doorHalfWidth, to: doorX + doorHalfWidth, bottom: 0, top: DOOR_TOP },
  ]);
  addWall('left', halfDepth * 2 + LOG_RADIUS * 2, [
    // The left wall is turned a quarter, so its own +X runs along +Z.
    {
      from: sideWindow.z - sideWindow.halfWidth,
      to: sideWindow.z + sideWindow.halfWidth,
      bottom: sideWindow.bottom,
      top: sideWindow.top,
    },
  ]);
  addWall('right', halfDepth * 2 + LOG_RADIUS * 2, []);

  /* -------------------------------------------------------------------- */
  /* Floor, beams, windows and the door                                   */
  /* -------------------------------------------------------------------- */

  const room = new ModelBuilder();
  const boards = Math.ceil((halfDepth * 2) / 0.3);
  for (let board = 0; board < boards; board++) {
    const z = -halfDepth + (board + 0.5) * ((halfDepth * 2) / boards);
    room.add(
      materials.floor,
      plankGeometry(
        halfWidth * 2 + 0.3,
        0.06,
        (halfDepth * 2) / boards - 0.012,
        'x',
        1.3,
        400 + board,
      ),
      placed(0, -0.03, z),
    );
  }
  // A ceiling beam across the back of the room to hang herbs from - only the
  // one, so nothing crosses the dollhouse view of the room.
  for (const z of canvasHome ? [] : [HERB_BEAM_Z]) {
    const beam = logGeometry(halfWidth * 2 + 0.4, 0.13, {
      sides: 8,
      seed: 420 + z * 10,
      tile: 0.8,
      ringEvery: 1.2,
    });
    const matrix = placed(0, wallHeight + 0.08, z);
    room.add(materials.bark, beam.side, matrix).add(materials.logEnds, beam.ends, matrix);
  }
  group.add(keep(room.build()));

  const addWindow = (
    side: 'back' | 'left',
    along: number,
    halfWidthOfWindow: number,
    bottom: number,
    top: number,
  ): void => {
    if (canvasHome) return;
    const frame = new ModelBuilder();
    const width = halfWidthOfWindow * 2;
    const height = top - bottom;
    const middle = (bottom + top) / 2;
    frame
      .add(
        materials.trim,
        plankGeometry(width + 0.16, 0.07, 0.34, 'x', 1, 430),
        placed(0, bottom - 0.035, 0),
      )
      .add(
        materials.trim,
        plankGeometry(width + 0.16, 0.07, 0.3, 'x', 1, 431),
        placed(0, top + 0.035, 0),
      )
      .add(
        materials.trim,
        plankGeometry(0.07, height, 0.3, 'y', 1, 432),
        placed(-halfWidthOfWindow - 0.035, middle, 0),
      )
      .add(
        materials.trim,
        plankGeometry(0.07, height, 0.3, 'y', 1, 433),
        placed(halfWidthOfWindow + 0.035, middle, 0),
      )
      // Glazing bars.
      .add(materials.trim, plankGeometry(0.04, height, 0.05, 'y', 1, 434), placed(0, middle, 0.02))
      .add(materials.trim, plankGeometry(width, 0.04, 0.05, 'x', 1, 435), placed(0, middle, 0.02))
      // A deep sill inside, for a candle or a plant one day.
      .add(
        materials.trim,
        plankGeometry(width + 0.3, 0.05, 0.3, 'x', 1, 436),
        placed(0, bottom - 0.08, -0.2),
      );
    const built = keep(frame.build());
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(width, height), windowGlass);
    glass.position.set(0, middle, 0.04);
    glass.rotation.y = Math.PI;
    disposers.push(() => glass.geometry.dispose());
    const holder = new THREE.Group();
    holder.add(built, glass);
    if (side === 'back') {
      holder.position.set(along, 0, -halfDepth - LOG_RADIUS);
      holder.rotation.y = Math.PI;
      walls.get('back')?.high.add(holderInWallSpace(holder, 'back'));
    } else {
      holder.position.set(-halfWidth - LOG_RADIUS, 0, along);
      holder.rotation.y = -Math.PI / 2;
      walls.get('left')?.high.add(holderInWallSpace(holder, 'left'));
    }
  };

  /**
   * A window built in room space, moved into its wall's own space so it
   * disappears with the wall when that wall is cut away.
   */
  const holderInWallSpace = (holder: THREE.Group, side: WallSide): THREE.Group => {
    const wall = new THREE.Group();
    placeWall(wall, side);
    wall.updateMatrixWorld(true);
    holder.applyMatrix4(wall.matrixWorld.clone().invert());
    return holder;
  };

  addWindow('back', backWindow.x, backWindow.halfWidth, backWindow.bottom, backWindow.top);
  addWindow('left', sideWindow.z, sideWindow.halfWidth, sideWindow.bottom, sideWindow.top);

  // The front door, closed, in its gap, and a frame round it.
  const door = new ModelBuilder();
  const doorWidth = doorHalfWidth * 2;
  for (let plank = 0; plank < 5; plank++) {
    door.add(
      materials.darkWood,
      plankGeometry(doorWidth / 5 - 0.01, DOOR_TOP - 0.05, 0.06, 'y', 1.1, 440 + plank),
      placed(-doorHalfWidth + (plank + 0.5) * (doorWidth / 5), (DOOR_TOP - 0.05) / 2, 0),
    );
  }
  door
    .add(
      materials.darkWood,
      plankGeometry(doorWidth, 0.1, 0.08, 'x', 1, 446),
      placed(0, 0.45, -0.04),
    )
    .add(
      materials.darkWood,
      plankGeometry(doorWidth, 0.1, 0.08, 'x', 1, 447),
      placed(0, 1.55, -0.04),
    )
    .add(
      materials.trim,
      plankGeometry(doorWidth + 0.2, 0.1, 0.34, 'x', 1, 448),
      placed(0, DOOR_TOP + 0.05, 0),
    )
    .add(
      materials.iron,
      new THREE.TorusGeometry(0.05, 0.013, 5, 10),
      placed(doorHalfWidth - 0.14, 1.0, -0.07),
    );
  const doorGroup = keep(door.build());
  doorGroup.position.set(doorX, 0, halfDepth + LOG_RADIUS);
  if (!canvasHome) walls.get('front')?.high.add(holderInWallSpace(doorGroup, 'front'));

  /* -------------------------------------------------------------------- */
  /* The hearth                                                           */
  /* -------------------------------------------------------------------- */

  const { hearth } = HOME_FURNITURE;
  const hearthModel = new ModelBuilder();
  const back = hearth.x + hearth.halfDepth;
  const front = hearth.x - hearth.halfDepth;
  const openingHalf = 0.42;
  const openingTop = 0.82;
  const pillarWidth = hearth.halfWidth - openingHalf;
  // Two stone pillars either side of the firebox, a lintel over it and a back.
  for (const side of [-1, 1]) {
    hearthModel.add(
      materials.cobbles,
      plankGeometry(hearth.halfDepth * 2, hearth.height, pillarWidth, 'y', 0.7, 450 + side),
      placed(hearth.x, hearth.height / 2, hearth.z + side * (openingHalf + pillarWidth / 2)),
    );
  }
  hearthModel
    .add(
      materials.cobbles,
      plankGeometry(
        hearth.halfDepth * 2,
        hearth.height - openingTop,
        openingHalf * 2,
        'y',
        0.7,
        453,
      ),
      placed(hearth.x, openingTop + (hearth.height - openingTop) / 2, hearth.z),
    )
    // A solid stone back to the firebox, blackened on the inside.
    .add(
      materials.cobbles,
      plankGeometry(0.14, openingTop, openingHalf * 2, 'y', 0.7, 459),
      placed(back - 0.07, openingTop / 2, hearth.z),
    )
    .add(
      materials.soot,
      plankGeometry(0.02, openingTop - 0.02, openingHalf * 2 - 0.02, 'y', 1, 454),
      placed(back - 0.15, openingTop / 2, hearth.z),
    )
    // The chimney breast, up to the beams.
    .add(
      materials.cobbles,
      plankGeometry(0.7, wallHeight - hearth.height + 0.1, 1.3, 'y', 0.7, 455),
      placed(back - 0.35, hearth.height + (wallHeight - hearth.height + 0.1) / 2, hearth.z),
    )
    // A thick oak mantel.
    .add(
      materials.darkWood,
      plankGeometry(0.34, 0.14, hearth.halfWidth * 2 + 0.3, 'z', 1, 456),
      placed(front + 0.1, hearth.height + 0.07, hearth.z),
    )
    // Flat hearthstones out in front, and the firebox floor.
    .add(
      materials.stone,
      plankGeometry(0.6, 0.05, hearth.halfWidth * 2 + 0.1, 'z', 0.8, 457),
      placed(front - 0.28, 0.025, hearth.z),
    )
    .add(
      materials.soot,
      plankGeometry(hearth.halfDepth * 2 - 0.1, 0.04, openingHalf * 2, 'x', 1, 458),
      placed(hearth.x, 0.02, hearth.z),
    );
  // Logs in the grate.
  for (const [offset, height, turn] of [
    [-0.12, 0.09, 0.12],
    [0.12, 0.09, -0.1],
    [0, 0.2, 0.02],
  ] as const) {
    const log = logGeometry(0.62, 0.065, {
      sides: 7,
      seed: 460 + offset * 10,
      tile: 0.5,
      ringEvery: 0.4,
    });
    const matrix = placed(hearth.x - 0.02, height, hearth.z + offset, { y: Math.PI / 2 + turn });
    hearthModel.add(materials.bark, log.side, matrix).add(materials.logEnds, log.ends, matrix);
  }
  // Things on the mantel: a candle each end and a little jar.
  for (const side of [-1, 1]) {
    hearthModel
      .add(
        materials.brass,
        new THREE.CylinderGeometry(0.05, 0.06, 0.03, 10),
        placed(front + 0.1, hearth.height + 0.155, hearth.z + side * 0.72),
      )
      .add(
        materials.linen,
        new THREE.CylinderGeometry(0.022, 0.022, 0.16, 8),
        placed(front + 0.1, hearth.height + 0.25, hearth.z + side * 0.72),
      );
  }
  const hearthGroup = keep(hearthModel.build());
  if (!canvasHome) group.add(hearthGroup);

  // The fire itself: the campfire's own animated flame, and its light.
  const fireGlow = createFireGlow(0xff8f45, 14, 9);
  fireGlow.anchor.position.set(front - 0.25, 0.55, hearth.z);
  if (!canvasHome) group.add(fireGlow.anchor);
  disposers.push(() => fireGlow.dispose());
  let flameMixer: THREE.AnimationMixer | null = null;
  const flameTemplate = flameModelTemplate();
  if (!canvasHome && flameTemplate !== undefined) {
    const flame = instantiateAnimatedModel(flameTemplate);
    flame.root.position.set(hearth.x - 0.02, 0.06, hearth.z);
    flame.root.scale.setScalar(0.7);
    for (const action of flame.actions) action.play();
    flameMixer = flame.mixer;
    group.add(flame.root);
  }

  /* -------------------------------------------------------------------- */
  /* The bed                                                              */
  /* -------------------------------------------------------------------- */

  const { bed } = HOME_FURNITURE;
  const bedModel = new ModelBuilder();
  const head = bed.z - bed.halfLength;
  const foot = bed.z + bed.halfLength;
  const bedWidth = bed.halfWidth * 2;
  // Four posts, taller at the head.
  for (const [x, z, height] of [
    [bed.x - bed.halfWidth + 0.05, head + 0.05, 0.9],
    [bed.x + bed.halfWidth - 0.05, head + 0.05, 0.9],
    [bed.x - bed.halfWidth + 0.05, foot - 0.05, 0.62],
    [bed.x + bed.halfWidth - 0.05, foot - 0.05, 0.62],
  ] as const) {
    bedModel
      .add(
        materials.darkWood,
        plankGeometry(0.1, height, 0.1, 'y', 1, 470 + x * z),
        placed(x, height / 2, z),
      )
      .add(materials.darkWood, new THREE.SphereGeometry(0.065, 8, 6), placed(x, height + 0.03, z));
  }
  bedModel
    // Side rails and end boards.
    .add(
      materials.darkWood,
      plankGeometry(0.06, 0.18, bed.halfLength * 2 - 0.1, 'z', 1, 475),
      placed(bed.x - bed.halfWidth + 0.05, 0.26, bed.z),
    )
    .add(
      materials.darkWood,
      plankGeometry(0.06, 0.18, bed.halfLength * 2 - 0.1, 'z', 1, 476),
      placed(bed.x + bed.halfWidth - 0.05, 0.26, bed.z),
    )
    .add(
      materials.darkWood,
      plankGeometry(bedWidth - 0.1, 0.55, 0.05, 'x', 1, 477),
      placed(bed.x, 0.48, head + 0.05),
    )
    .add(
      materials.darkWood,
      plankGeometry(bedWidth - 0.1, 0.32, 0.05, 'x', 1, 478),
      placed(bed.x, 0.36, foot - 0.05),
    )
    // Mattress and a turned-down sheet.
    .add(
      materials.linen,
      plankGeometry(bedWidth - 0.14, 0.2, bed.halfLength * 2 - 0.14, 'z', 0.6, 479),
      placed(bed.x, 0.38, bed.z),
    )
    // The quilt, folded back at the top, draping a little over the sides.
    .add(
      materials.quilt,
      plankGeometry(bedWidth + 0.02, 0.06, bed.halfLength * 1.35, 'z', 1.1, 480),
      placed(bed.x, 0.505, foot - 0.07 - bed.halfLength * 0.675),
    )
    .add(
      materials.quilt,
      plankGeometry(bedWidth - 0.1, 0.05, 0.22, 'x', 1.1, 481),
      placed(bed.x, 0.54, foot - 0.07 - bed.halfLength * 1.35 + 0.08, { x: 0.25 }),
    )
    // A plump pillow at the head.
    .add(materials.linen, ellipsoid(0.34, 0.08, 0.19, 12, 8), placed(bed.x, 0.54, head + 0.28));
  const bedGroup = keep(bedModel.build());
  if (!canvasHome) group.add(bedGroup);
  else {
    // A padded bedroll on a low travel cot; resting height stays the same.
    const roll = new ModelBuilder();
    roll.add(
      materials.darkWood,
      plankGeometry(bedWidth, 0.16, bed.halfLength * 2, 'z', 1, 1200),
      placed(bed.x, 0.1, bed.z),
    );
    roll.add(
      materials.quilt,
      plankGeometry(bedWidth, 0.28, bed.halfLength * 2, 'z', 0.8, 1201),
      placed(bed.x, 0.36, bed.z),
    );
    roll.add(materials.linen, ellipsoid(0.34, 0.07, 0.18, 10, 6), placed(bed.x, 0.54, head + 0.3));
    roll.add(
      materials.linen,
      new THREE.CylinderGeometry(0.13, 0.13, bedWidth - 0.12, 10).rotateZ(Math.PI / 2),
      placed(bed.x, 0.55, foot - 0.14),
    );
    group.add(keep(roll.build()));
  }
  const chest = new THREE.Group();
  chest.name = 'storage-chest';
  const chestShape = HOME_FURNITURE.chest;
  chest.position.set(chestShape.x, 0, chestShape.z);
  const chestBody = new ModelBuilder();
  chestBody
    .add(materials.darkWood, plankGeometry(0.9, 0.45, 0.46, 'x', 1, 482), placed(0, 0.225, 0))
    .add(materials.iron, plankGeometry(0.94, 0.04, 0.02, 'x', 1, 0), placed(0, 0.32, 0.24))
    .add(materials.brass, new THREE.BoxGeometry(0.08, 0.1, 0.03), placed(0, 0.4, 0.245));
  chest.add(keep(chestBody.build()));
  const lid = new THREE.Group();
  lid.position.set(0, 0.45, -0.25);
  const lidModel = new ModelBuilder();
  lidModel.add(
    materials.darkWood,
    plankGeometry(0.94, 0.06, 0.5, 'x', 1, 483),
    placed(0, 0.03, 0.25),
  );
  lid.add(keep(lidModel.build()));
  chest.add(lid);
  group.add(chest);
  let chestOpen = false;

  /* -------------------------------------------------------------------- */
  /* Table, chair and lamp                                                */
  /* -------------------------------------------------------------------- */

  const { table, chair } = HOME_FURNITURE;
  const tableModel = new ModelBuilder();
  tableModel.add(
    materials.floor,
    plankGeometry(table.halfWidth * 2, 0.05, table.halfLength * 2, 'z', 1, 490),
    placed(table.x, table.height - 0.025, table.z),
  );
  for (const [dx, dz] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const) {
    tableModel.add(
      materials.darkWood,
      plankGeometry(0.06, table.height - 0.05, 0.06, 'y', 1, 491 + dx + dz * 2),
      placed(
        table.x + dx * (table.halfWidth - 0.07),
        (table.height - 0.05) / 2,
        table.z + dz * (table.halfLength - 0.07),
      ),
    );
  }
  // The chair, pulled up facing the table: its back is on the far side.
  const seatHeight = 0.4;
  const behind = chair.x + 0.2;
  tableModel.add(
    materials.floor,
    plankGeometry(0.42, 0.05, 0.42, 'x', 1, 495),
    placed(chair.x, seatHeight, chair.z),
  );
  for (const [dx, dz] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const) {
    const tall = dx > 0;
    const height = tall ? 0.9 : seatHeight;
    tableModel.add(
      materials.darkWood,
      plankGeometry(0.045, height, 0.045, 'y', 1, 496 + dx + dz * 2),
      placed(chair.x + dx * 0.18, height / 2, chair.z + dz * 0.18),
    );
  }
  for (const y of [0.6, 0.74, 0.86]) {
    tableModel.add(
      materials.floor,
      plankGeometry(0.03, 0.06, 0.38, 'z', 1, 500 + y * 10),
      placed(behind - 0.02, y, chair.z),
    );
  }
  // An oil lamp on the table, and a mug.
  tableModel
    .add(
      materials.brass,
      new THREE.CylinderGeometry(0.07, 0.09, 0.05, 12),
      placed(table.x + 0.05, table.height + 0.025, table.z - 0.25),
    )
    .add(
      materials.brass,
      new THREE.CylinderGeometry(0.045, 0.07, 0.08, 12),
      placed(table.x + 0.05, table.height + 0.09, table.z - 0.25),
    )
    .add(
      materials.lampGlass,
      new THREE.CylinderGeometry(0.035, 0.05, 0.16, 12),
      placed(table.x + 0.05, table.height + 0.21, table.z - 0.25),
    )
    .add(
      materials.stone,
      new THREE.CylinderGeometry(0.045, 0.04, 0.1, 10),
      placed(table.x + 0.12, table.height + 0.05, table.z + 0.3),
    );
  const tableGroup = keep(tableModel.build());
  if (kind !== 'tent') group.add(tableGroup);
  // A steady flame behind glass: no flicker.
  const lampGlow = createFireGlow(0xffb866, 1, 5, 0);
  lampGlow.anchor.position.set(
    table.x + 0.05,
    kind === 'tent' ? 0.5 : table.height + 0.32,
    table.z - 0.25,
  );
  group.add(lampGlow.anchor);
  if (kind === 'tent') {
    const lantern = new ModelBuilder();
    const x = table.x + 0.05,
      z = table.z - 0.25;
    lantern.add(
      materials.darkWood,
      new THREE.CylinderGeometry(0.22, 0.25, 0.24, 8),
      placed(x, 0.12, z),
    );
    lantern.add(materials.lampGlass, new THREE.BoxGeometry(0.15, 0.22, 0.15), placed(x, 0.36, z));
    lantern.add(
      materials.iron,
      new THREE.ConeGeometry(0.17, 0.1, 4),
      placed(x, 0.51, z, { y: Math.PI / 4 }),
    );
    group.add(keep(lantern.build()));
  }
  disposers.push(() => lampGlow.dispose());

  /* -------------------------------------------------------------------- */
  /* Shelf, woodbox, herbs and the rug                                    */
  /* -------------------------------------------------------------------- */

  const { shelf, rug } = HOME_FURNITURE;
  const shelfModel = new ModelBuilder();
  const random = seededRandom(510);
  const shelfBack = shelf.x + shelf.halfDepth;
  // Two sides and three boards.
  for (const side of [-1, 1]) {
    shelfModel.add(
      materials.darkWood,
      plankGeometry(shelf.halfDepth * 2, shelf.height, 0.05, 'y', 1, 511 + side),
      placed(shelf.x, shelf.height / 2, shelf.z + side * (shelf.halfWidth - 0.025)),
    );
  }
  const boardHeights = [0.1, 0.75, 1.3, shelf.height - 0.03];
  for (const [index, y] of boardHeights.entries()) {
    shelfModel.add(
      materials.floor,
      plankGeometry(shelf.halfDepth * 2, 0.04, shelf.halfWidth * 2 - 0.1, 'z', 1, 515 + index),
      placed(shelf.x, y, shelf.z),
    );
  }
  // Books on the middle board, leaning a little at the end of the row.
  const spines = [0x8a3b2e, 0x3e5d74, 0x6b7a43, 0xb88a3c, 0x5a3f5f, 0x2f4a3d];
  let along = shelf.z - shelf.halfWidth + 0.12;
  for (let book = 0; book < 9; book++) {
    const thickness = 0.04 + random() * 0.04;
    const height = 0.2 + random() * 0.1;
    const lean = book === 8 ? 0.35 : 0;
    shelfModel.add(
      plainMaterial(spines[book % spines.length] ?? 0x8a3b2e, { roughness: 0.85 }),
      new THREE.BoxGeometry(0.2, height, thickness),
      placed(shelfBack - 0.14, 0.77 + height / 2, along + thickness / 2, { x: lean }),
    );
    along += thickness + 0.005;
  }
  // Jars and crocks on the top board and the bottom one.
  const jarColours = [0xd9e7d8, 0xe8d6b0, 0xc9d8e4];
  for (let jar = 0; jar < 4; jar++) {
    const z = shelf.z - shelf.halfWidth + 0.2 + jar * 0.32;
    const height = 0.16 + random() * 0.08;
    shelfModel
      .add(
        plainMaterial(jarColours[jar % jarColours.length] ?? 0xd9e7d8, { roughness: 0.25 }),
        new THREE.CylinderGeometry(0.07, 0.075, height, 12),
        placed(shelfBack - 0.15, 1.32 + height / 2, z),
      )
      .add(
        materials.darkWood,
        new THREE.CylinderGeometry(0.075, 0.075, 0.03, 12),
        placed(shelfBack - 0.15, 1.32 + height + 0.015, z),
      );
  }
  for (let crock = 0; crock < 3; crock++) {
    shelfModel.add(
      materials.stone,
      new THREE.CylinderGeometry(0.1, 0.12, 0.24, 12),
      placed(shelfBack - 0.16, 0.12 + 0.12, shelf.z - 0.4 + crock * 0.4),
    );
  }
  // A small potted plant on top.
  shelfModel
    .add(
      materials.stone,
      new THREE.CylinderGeometry(0.08, 0.06, 0.13, 10),
      placed(shelfBack - 0.15, shelf.height + 0.05, shelf.z + 0.45),
    )
    .add(
      materials.herbGreen,
      ellipsoid(0.13, 0.12, 0.13, 8, 6),
      placed(shelfBack - 0.15, shelf.height + 0.2, shelf.z + 0.45),
    );
  // A box of split logs by the hearth.
  const box = { x: 3.1, z: 0.45 };
  shelfModel
    .add(
      materials.darkWood,
      plankGeometry(0.5, 0.32, 0.55, 'x', 1, 530),
      placed(box.x, 0.16, box.z),
    )
    .add(materials.soot, plankGeometry(0.42, 0.02, 0.47, 'x', 1, 0), placed(box.x, 0.31, box.z));
  for (let log = 0; log < 5; log++) {
    const piece = logGeometry(0.46, 0.06, { sides: 6, seed: 531 + log, tile: 0.5, ringEvery: 0.5 });
    const matrix = placed(
      box.x - 0.15 + (log % 3) * 0.14,
      0.36 + Math.floor(log / 3) * 0.1,
      box.z,
      { y: Math.PI / 2 },
    );
    shelfModel.add(materials.bark, piece.side, matrix).add(materials.logEnds, piece.ends, matrix);
  }
  // Bunches of herbs drying, hung from the beam near the hearth.
  const herbs = [materials.herbGreen, materials.herbLavender, materials.herbYarrow];
  for (let bunch = 0; bunch < 5; bunch++) {
    const x = 1.3 + bunch * 0.32;
    const drop = 0.28 + random() * 0.14;
    shelfModel
      .add(
        materials.string,
        new THREE.CylinderGeometry(0.006, 0.006, drop, 4),
        placed(x, wallHeight - drop / 2, HERB_BEAM_Z),
      )
      .add(
        herbs[bunch % herbs.length] ?? materials.herbGreen,
        new THREE.ConeGeometry(0.07, 0.3, 7),
        placed(x, wallHeight - drop - 0.12, HERB_BEAM_Z, { x: Math.PI }),
      );
  }
  const shelfGroup = keep(shelfModel.build());
  if (!canvasHome) group.add(shelfGroup);

  const rugMesh = new THREE.Mesh(new THREE.CircleGeometry(1, 48), materials.rug);
  rugMesh.rotation.x = -Math.PI / 2;
  rugMesh.scale.set(rug.radiusX, rug.radiusZ, 1);
  rugMesh.position.set(rug.x, 0.006, rug.z);
  rugMesh.receiveShadow = true;
  group.add(rugMesh);
  disposers.push(() => rugMesh.geometry.dispose());

  // A doormat inside the door.
  const mat = new THREE.Mesh(
    new THREE.PlaneGeometry(1.0, 0.6),
    paintedMaterial('burlap', { tint: 0xc9a86f }),
  );
  mat.rotation.x = -Math.PI / 2;
  mat.position.set(doorX, 0.005, halfDepth - 0.45);
  mat.receiveShadow = true;
  group.add(mat);
  disposers.push(() => mat.geometry.dispose());

  // Scattered stones along the hearth's foot, so it sits into the floor.
  const pebbles = new ModelBuilder();
  for (let stone = 0; stone < 4; stone++) {
    pebbles.add(
      materials.stone,
      stoneGeometry(0.08 + random() * 0.04, 0.05, 540 + stone, 0.4, 0),
      placed(front - 0.62, 0.02, hearth.z - 0.7 + stone * 0.46),
    );
  }
  const pebbleGroup = keep(pebbles.build());
  if (!canvasHome) group.add(pebbleGroup);

  return {
    group,
    chest,
    garden: facilities.garden,
    setGardenPlots: facilities.setGardenPlots,
    setChestOpen(open) {
      chestOpen = open;
    },
    cutAway(cameraX, cameraZ) {
      const length = Math.hypot(cameraX, cameraZ) || 1;
      for (const [side, wall] of walls) {
        const normal = WALL_NORMALS[side];
        const facing = (normal.x * cameraX + normal.z * cameraZ) / length;
        wall.high.visible = !canvasHome && facing < CUTAWAY_COSINE;
      }
    },
    update(deltaSeconds, daylight) {
      lid.rotation.x +=
        ((chestOpen ? -0.95 : 0) - lid.rotation.x) * (1 - Math.exp(-deltaSeconds * 9));
      flameMixer?.update(deltaSeconds);
      fireGlow.update(deltaSeconds);
      // The fire and the lamp matter far more once the windows go dark.
      const night = 1 - daylight;
      fireGlow.brightness = 0.75 + night * 0.6;
      lampGlow.brightness = 1.2 + night * 3.2;
      windowGlass.emissive.setRGB(
        0.5 + daylight * 0.36,
        0.56 + daylight * 0.36,
        0.72 + daylight * 0.28,
      );
      windowGlass.emissiveIntensity = 0.12 + daylight * 0.85;
    },
    dispose() {
      for (const dispose of disposers) dispose();
      flameMixer?.stopAllAction();
    },
  };
}
