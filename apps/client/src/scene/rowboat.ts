import * as THREE from 'three/webgpu';

import { paintedMaterial } from '../art/materials';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';

/**
 * A rowboat (see decision 0092): a plain timber hull with a pointed bow, two
 * seats, a coil of rope in the bow and a pair of oars laid along the bottom.
 *
 * Its length runs along the model's own X axis with the bow at +X, and the
 * waterline is at local y = 0: the hull reaches a little below it (hidden
 * under the water) and its rim stands a little above. It is about 3.2 m long
 * and 1.2 m across, which is the room its footprint keeps clear.
 */
export interface Rowboat {
  readonly group: THREE.Group;
  dispose(): void;
}

/** Half the hull's length and width, at its longest and widest. */
const HALF_LENGTH = 1.6;
const HALF_BEAM = 0.62;
/** How thick the planking is, seen from above. */
const WALL = 0.085;
/** Keel, waterline and rim, as heights above the waterline. */
const KEEL_Y = -0.2;
const CHINE_Y = 0.05;
const RIM_Y = 0.3;
const FLOOR_THICKNESS = 0.06;
/** Below the chine the hull narrows, the way a real one tucks in under the water. */
const BELOW_CHINE_NARROWING = 0.78;

/** The hull seen from above: a pointed bow at +X, a blunt stern at -X. */
function hullOutline(halfLength: number, halfBeam: number): THREE.Shape {
  const stern = halfBeam * 0.58;
  const shape = new THREE.Shape();
  shape.moveTo(halfLength, 0);
  shape.bezierCurveTo(
    halfLength * 0.6,
    halfBeam * 0.95,
    halfLength * 0.15,
    halfBeam,
    -halfLength * 0.35,
    halfBeam,
  );
  shape.bezierCurveTo(
    -halfLength * 0.75,
    halfBeam,
    -halfLength,
    halfBeam * 0.82,
    -halfLength,
    stern,
  );
  shape.lineTo(-halfLength, -stern);
  shape.bezierCurveTo(
    -halfLength,
    -halfBeam * 0.82,
    -halfLength * 0.75,
    -halfBeam,
    -halfLength * 0.35,
    -halfBeam,
  );
  shape.bezierCurveTo(
    halfLength * 0.15,
    -halfBeam,
    halfLength * 0.6,
    -halfBeam * 0.95,
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
  builder.add(
    planking,
    slab(wallOutline(HALF_LENGTH, HALF_BEAM * BELOW_CHINE_NARROWING), KEEL_Y, CHINE_Y - KEEL_Y),
  );
  // The floor, a little above the keel, so you cannot see through to the water.
  builder.add(
    trim,
    slab(
      hullOutline(HALF_LENGTH - 0.05, HALF_BEAM * BELOW_CHINE_NARROWING - 0.02),
      KEEL_Y,
      FLOOR_THICKNESS,
    ),
  );

  // Two seats across the boat; the forward one is shorter, where the bow narrows.
  for (const [x, width] of [
    [-0.4, 1.06],
    [0.5, 0.86],
  ] as const) {
    builder.add(trim, plankGeometry(0.22, 0.045, width, 'z', 0.6, x * 10), placed(x, 0.12, 0));
  }

  // Oarlocks on the rim, a little behind the middle.
  for (const side of [-1, 1]) {
    builder.add(
      trim,
      new THREE.CylinderGeometry(0.025, 0.03, 0.14, 6),
      placed(0.05, RIM_Y + 0.05, side * (HALF_BEAM - WALL / 2)),
    );
  }

  // A pair of oars laid along the bottom, blades towards the stern.
  for (const side of [-1, 1]) {
    builder.add(
      trim,
      new THREE.CylinderGeometry(0.022, 0.022, 1.7, 6),
      placed(0.1, -0.1, side * 0.3, { z: Math.PI / 2 }),
    );
    builder.add(planking, new THREE.BoxGeometry(0.4, 0.015, 0.11), placed(-0.95, -0.1, side * 0.3));
  }

  // A coil of rope in the bow, the rope it was lashed with.
  builder.add(
    rope,
    new THREE.TorusGeometry(0.1, 0.028, 5, 10),
    placed(1.05, -0.12, 0, { x: Math.PI / 2 }),
  );

  return builder.build();
}
