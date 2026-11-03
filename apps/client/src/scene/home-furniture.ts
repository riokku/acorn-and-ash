import * as THREE from 'three/webgpu';
import { HOME_FURNITURE_SHAPES, type GardenPlot, type HomeFurnitureKind } from '@acorn/shared';
import { paintedMaterial, plainMaterial } from '../art/materials';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';
import { ellipsoid } from './critter';
import { createHomeFacilities } from './home-facilities';
import { createStorageChest } from './storage-chest';

/**
 * The furniture a home used to come with, now built and placed by its owner
 * (decision 0285): the bed, the desk and its chair, the storage chest and the
 * large cabin's indoor garden. Each is drawn round its own middle, the way
 * `HOME_FURNITURE_SHAPES` lays it out, so what you see is what you bump into.
 * These are the same placeholder shapes the rooms used to have built in.
 */
export interface HomeFurnitureModel {
  readonly group: THREE.Group;
  /** The lid swings open while its owner has the chest open. */
  setChestOpen?(open: boolean): void;
  /** What grows in each of the garden's three trays. */
  setGardenPlots?(plots: readonly GardenPlot[]): void;
  update?(deltaSeconds: number): void;
  dispose(): void;
}

const materials = () => ({
  darkWood: paintedMaterial('wood', { tint: 0x8f6444, roughness: 0.8 }),
  floor: paintedMaterial('wood', { tint: 0xd7ad82, roughness: 0.8 }),
  linen: paintedMaterial('burlap', { tint: 0xfbf4e4, roughness: 1 }),
  quilt: paintedMaterial('quilt', { roughness: 0.95 }),
  stone: paintedMaterial('stone', { roughness: 1, flatShading: true }),
  iron: plainMaterial(0x3b3733, { roughness: 0.55 }),
  brass: plainMaterial(0xb68a3e, { roughness: 0.35 }),
});

export function createHomeFurniture(kind: HomeFurnitureKind): HomeFurnitureModel {
  if (kind === 'bed') return createBed();
  if (kind === 'desk') return createDesk();
  if (kind === 'storageChest') return createChest();
  return createGarden();
}

/** Four posts, a mattress and a quilt, lengthways along Z with the headboard at -Z. */
function createBed(): HomeFurnitureModel {
  const m = materials();
  const bed = HOME_FURNITURE_SHAPES.bed[0]!;
  const model = new ModelBuilder();
  const head = bed.z - bed.halfZ;
  const foot = bed.z + bed.halfZ;
  const bedWidth = bed.halfX * 2;
  // Four posts, taller at the head.
  for (const [x, z, height] of [
    [bed.x - bed.halfX + 0.05, head + 0.05, 0.9],
    [bed.x + bed.halfX - 0.05, head + 0.05, 0.9],
    [bed.x - bed.halfX + 0.05, foot - 0.05, 0.62],
    [bed.x + bed.halfX - 0.05, foot - 0.05, 0.62],
  ] as const) {
    model
      .add(
        m.darkWood,
        plankGeometry(0.1, height, 0.1, 'y', 1, 470 + x * z),
        placed(x, height / 2, z),
      )
      .add(m.darkWood, new THREE.SphereGeometry(0.065, 8, 6), placed(x, height + 0.03, z));
  }
  model
    // Side rails and end boards.
    .add(
      m.darkWood,
      plankGeometry(0.06, 0.18, bed.halfZ * 2 - 0.1, 'z', 1, 475),
      placed(bed.x - bed.halfX + 0.05, 0.26, bed.z),
    )
    .add(
      m.darkWood,
      plankGeometry(0.06, 0.18, bed.halfZ * 2 - 0.1, 'z', 1, 476),
      placed(bed.x + bed.halfX - 0.05, 0.26, bed.z),
    )
    .add(
      m.darkWood,
      plankGeometry(bedWidth - 0.1, 0.55, 0.05, 'x', 1, 477),
      placed(bed.x, 0.48, head + 0.05),
    )
    .add(
      m.darkWood,
      plankGeometry(bedWidth - 0.1, 0.32, 0.05, 'x', 1, 478),
      placed(bed.x, 0.36, foot - 0.05),
    )
    // Mattress and a turned-down sheet.
    .add(
      m.linen,
      plankGeometry(bedWidth - 0.14, 0.2, bed.halfZ * 2 - 0.14, 'z', 0.6, 479),
      placed(bed.x, 0.38, bed.z),
    )
    // The quilt, folded back at the top, draping a little over the sides.
    .add(
      m.quilt,
      plankGeometry(bedWidth + 0.02, 0.06, bed.halfZ * 1.35, 'z', 1.1, 480),
      placed(bed.x, 0.505, foot - 0.07 - bed.halfZ * 0.675),
    )
    .add(
      m.quilt,
      plankGeometry(bedWidth - 0.1, 0.05, 0.22, 'x', 1.1, 481),
      placed(bed.x, 0.54, foot - 0.07 - bed.halfZ * 1.35 + 0.08, { x: 0.25 }),
    )
    // A plump pillow at the head.
    .add(m.linen, ellipsoid(0.34, 0.08, 0.19, 12, 8), placed(bed.x, 0.54, head + 0.28));
  const built = model.build();
  built.group.name = 'bed';
  return built;
}

/** The table, the chair pulled up to its +X side, and the workbench's tools on top. */
function createDesk(): HomeFurnitureModel {
  const m = materials();
  const [table, seat] = HOME_FURNITURE_SHAPES.desk as readonly [
    (typeof HOME_FURNITURE_SHAPES.desk)[number],
    (typeof HOME_FURNITURE_SHAPES.desk)[number],
  ];
  const model = new ModelBuilder();
  model.add(
    m.floor,
    plankGeometry(table.halfX * 2, 0.05, table.halfZ * 2, 'z', 1, 490),
    placed(table.x, table.height - 0.025, table.z),
  );
  for (const [dx, dz] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const) {
    model.add(
      m.darkWood,
      plankGeometry(0.06, table.height - 0.05, 0.06, 'y', 1, 491 + dx + dz * 2),
      placed(
        table.x + dx * (table.halfX - 0.07),
        (table.height - 0.05) / 2,
        table.z + dz * (table.halfZ - 0.07),
      ),
    );
  }
  // The chair, facing the table: its back is on the far side.
  const seatHeight = 0.4;
  const behind = seat.x + 0.2;
  model.add(
    m.floor,
    plankGeometry(0.42, 0.05, 0.42, 'x', 1, 495),
    placed(seat.x, seatHeight, seat.z),
  );
  for (const [dx, dz] of [
    [-1, -1],
    [-1, 1],
    [1, -1],
    [1, 1],
  ] as const) {
    const height = dx > 0 ? 0.9 : seatHeight;
    model.add(
      m.darkWood,
      plankGeometry(0.045, height, 0.045, 'y', 1, 496 + dx + dz * 2),
      placed(seat.x + dx * 0.18, height / 2, seat.z + dz * 0.18),
    );
  }
  for (const y of [0.6, 0.74, 0.86]) {
    model.add(
      m.floor,
      plankGeometry(0.03, 0.06, 0.38, 'z', 1, 500 + y * 10),
      placed(behind - 0.02, y, seat.z),
    );
  }
  const built = model.build();
  built.group.name = 'desk';
  // The tools that make it a workbench.
  const tools = createHomeFacilities('workbench');
  tools.group.position.set(table.x, 0, table.z);
  built.group.add(tools.group);
  return {
    group: built.group,
    dispose() {
      built.dispose();
      tools.dispose();
    },
  };
}

function createChest(): HomeFurnitureModel {
  const m = materials();
  const storage = createStorageChest(m);
  storage.group.name = 'storage-chest';
  let open = false;
  return {
    group: storage.group,
    setChestOpen(value) {
      open = value;
    },
    update(deltaSeconds) {
      storage.lid.rotation.x +=
        ((open ? -0.95 : 0) - storage.lid.rotation.x) * (1 - Math.exp(-deltaSeconds * 9));
    },
    dispose: storage.dispose,
  };
}

function createGarden(): HomeFurnitureModel {
  const fittings = createHomeFacilities('garden');
  fittings.group.name = 'indoor-garden';
  return {
    group: fittings.group,
    setGardenPlots: fittings.setGardenPlots,
    dispose: fittings.dispose,
  };
}
