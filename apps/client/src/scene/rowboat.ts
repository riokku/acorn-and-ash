import * as THREE from 'three/webgpu';

import { BOAT_SEAT_HEIGHT } from '@acorn/shared';

import { paintedMaterial } from '../art/materials';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';

/**
 * A temporary timber canoe using the existing painted boat materials. Its
 * double-ended hull is 3.34 m long and 0.84 m wide, with one visible paddler
 * on the middle thwart. Local +X is the bow, local y=0 the waterline.
 * The legacy Rowboat API and saved kind remain compatible with existing worlds.
 */
export interface Rowboat {
  readonly group: THREE.Group;
  /** Paddle with the rider's stroke, or lay it inside an unattended canoe. */
  setRowing(stroke: number | null, pulling?: boolean): void;
  dispose(): void;
}

/** Half the hull's length and width, at its longest and widest. */
const HALF_LENGTH = 1.67;
const HALF_BEAM = 0.42;
/** How thick the planking is, seen from above. */
const WALL = 0.055;
/** Keel, waterline and rim, as heights above the waterline. */
const KEEL_Y = -0.1;
const CHINE_Y = 0.05;
const RIM_Y = 0.28;
const FLOOR_THICKNESS = 0.04;
/** Below the chine the hull narrows, the way a real one tucks in under the water. */
const BELOW_CHINE_NARROWING = 0.78;

/** Pointed at both ends, with a rounded belly for the paddler. */
function hullOutline(halfLength: number, halfBeam: number): THREE.Shape {
  const shape = new THREE.Shape();
  shape.moveTo(halfLength, 0);
  shape.bezierCurveTo(halfLength * 0.7, halfBeam * 0.7, halfLength * 0.35, halfBeam, 0, halfBeam);
  shape.bezierCurveTo(
    -halfLength * 0.35,
    halfBeam,
    -halfLength * 0.7,
    halfBeam * 0.7,
    -halfLength,
    0,
  );
  shape.bezierCurveTo(
    -halfLength * 0.7,
    -halfBeam * 0.7,
    -halfLength * 0.35,
    -halfBeam,
    0,
    -halfBeam,
  );
  shape.bezierCurveTo(
    halfLength * 0.35,
    -halfBeam,
    halfLength * 0.7,
    -halfBeam * 0.7,
    halfLength,
    0,
  );
  return shape;
}

/** The outline stood up into a slab of this height, its underside at `bottom`. */
function slab(outline: THREE.Shape, bottom: number, height: number): THREE.BufferGeometry {
  const geometry = new THREE.ExtrudeGeometry(outline, {
    depth: height,
    bevelEnabled: false,
    curveSegments: 8,
  });
  // The outline is drawn on the ground (X and Y) and extruded along Z: stand
  // it up so the extrusion is the height.
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottom, 0);
  return geometry;
}

/** The planking all round: the outer outline with the inner one cut out of it. */
function wallOutline(halfLength: number, halfBeam: number): THREE.Shape {
  const wall = hullOutline(halfLength, halfBeam);
  const inside = hullOutline(halfLength - WALL * 1.4, halfBeam - WALL);
  wall.holes.push(new THREE.Path(inside.getPoints(8)));
  return wall;
}

export function createRowboat(): Rowboat {
  const planking = paintedMaterial('wood', { tint: 0xb5834f, roughness: 0.9 });
  const trim = paintedMaterial('wood', { tint: 0x80573a, roughness: 0.9 });
  const rope = paintedMaterial('burlap', { tint: 0xd8c18a, roughness: 1 });

  const builder = new ModelBuilder();

  // The planking: a narrower tub under the waterline, the full width above it.
  builder.add(planking, slab(wallOutline(HALF_LENGTH, HALF_BEAM), CHINE_Y, RIM_Y - CHINE_Y));
  const lowerHull = slab(wallOutline(HALF_LENGTH, HALF_BEAM), KEEL_Y, CHINE_Y - KEEL_Y);
  const vertices = lowerHull.getAttribute('position');
  for (let index = 0; index < vertices.count; index++) {
    const rise = (vertices.getY(index) - KEEL_Y) / (CHINE_Y - KEEL_Y);
    const taper = BELOW_CHINE_NARROWING + (1 - BELOW_CHINE_NARROWING) * rise;
    vertices.setZ(index, vertices.getZ(index) * taper);
  }
  lowerHull.computeVertexNormals();
  builder.add(planking, lowerHull);
  // Close the underside too: the canoe is a hull, not an open ring.
  builder.add(
    trim,
    slab(
      hullOutline(HALF_LENGTH - 0.05, HALF_BEAM * BELOW_CHINE_NARROWING - 0.02),
      KEEL_Y,
      FLOOR_THICKNESS,
    ),
  );
  // A dry inner sole just above the water plane; the shallow keel remains
  // below it. This keeps the shared water surface out of the open interior.
  builder.add(
    trim,
    slab(hullOutline(HALF_LENGTH - WALL * 1.4, HALF_BEAM - WALL), 0.025, FLOOR_THICKNESS),
  );

  // The paddler's seat across the middle, and a smaller stern thwart.
  for (const [x, width] of [
    [0, 0.72],
    [-0.85, 0.55],
  ] as const) {
    builder.add(
      trim,
      plankGeometry(0.22, 0.045, width, 'z', 0.6, x * 10 + 3),
      placed(x, BOAT_SEAT_HEIGHT - 0.03, 0),
    );
  }

  builder.add(trim, slab(wallOutline(HALF_LENGTH, HALF_BEAM), RIM_Y, 0.025));

  // A coil of rope in the bow, the rope it was lashed with.
  builder.add(
    rope,
    new THREE.TorusGeometry(0.1, 0.028, 5, 10),
    placed(1.05, 0.09, 0, { x: Math.PI / 2 }),
  );

  const built = builder.build();
  built.group.name = 'canoe';
  const paddle = createPaddle(planking, trim);
  built.group.add(paddle.pivot);
  const setRowing = (stroke: number | null, pulling = true): void => {
    if (stroke === null) {
      // Stowed lengthwise; no wide oars to snag the river banks.
      paddle.pivot.position.set(0.4, 0.08, 0.18);
      paddle.pivot.rotation.set(0, 0, -Math.PI / 2);
    } else {
      const phase = stroke * Math.PI * 2;
      paddle.pivot.position.set(0.22, 0.72, 0.25);
      paddle.pivot.rotation.set(0.28, 0, pulling ? Math.cos(phase) * 0.5 : 0.35);
    }
  };
  setRowing(null);
  return {
    group: built.group,
    setRowing,
    dispose: () => {
      built.dispose();
      for (const geometry of paddle.geometries) geometry.dispose();
    },
  };
}

/** A single slim paddle, turning about the paddler's hands. */
function createPaddle(bladeMaterial: THREE.Material, shaftMaterial: THREE.Material) {
  const shaft = new THREE.CylinderGeometry(0.018, 0.018, 1.2, 6);
  shaft.translate(0, -0.18, 0);
  const blade = plankGeometry(0.18, 0.4, 0.025, 'y', 0.6, 7);
  blade.translate(0, -0.95, 0);
  const grip = new THREE.BoxGeometry(0.12, 0.025, 0.035);
  grip.translate(0, 0.43, 0);
  const pivot = new THREE.Group();
  pivot.name = 'canoe-paddle';
  for (const [geometry, material] of [
    [shaft, shaftMaterial],
    [blade, bladeMaterial],
    [grip, shaftMaterial],
  ] as const) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    pivot.add(mesh);
  }
  return { pivot, geometries: [shaft, blade, grip] };
}
