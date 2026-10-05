import * as THREE from 'three/webgpu';

import { BOAT_SEAT_HEIGHT } from '@acorn/shared';

import { paintedMaterial } from '../art/materials';
import { ModelBuilder, placed, plankGeometry } from '../art/shapes';

/**
 * A rowboat (see decisions 0092 and 0093): a plain timber hull with a pointed
 * bow, a seat for the rower in the middle and one in the stern, a coil of rope
 * in the bow and a pair of oars - laid along the bottom while it is moored,
 * out over the sides and sweeping while somebody rows.
 *
 * Its length runs along the model's own X axis with the bow at +X, and the
 * waterline is at local y = 0: the hull reaches a little below it (hidden
 * under the water) and its rim stands a little above. It is about 3.2 m long
 * and 1.2 m across, which is the room its footprint keeps clear. Whoever
 * rows sits on the middle seat, which is at the model's origin.
 */
export interface Rowboat {
  readonly group: THREE.Group;
  /**
   * Put the oars out and sweep them, or ship them again. `stroke` is how far
   * through a stroke the rower is, from 0 to 1 (and on round again), or null
   * for the oars laid along the bottom. With `pulling` false the oars are out
   * and resting just above the water, as when gliding.
   */
  setRowing(stroke: number | null, pulling?: boolean): void;
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

  // The rower's seat across the middle, and one in the stern.
  for (const [x, width] of [
    [0, 1.08],
    [-0.9, 0.9],
  ] as const) {
    builder.add(
      trim,
      plankGeometry(0.22, 0.045, width, 'z', 0.6, x * 10 + 3),
      placed(x, BOAT_SEAT_HEIGHT - 0.03, 0),
    );
  }

  // Oarlocks on the rim, level with the rower.
  for (const side of [-1, 1]) {
    builder.add(
      trim,
      new THREE.CylinderGeometry(0.025, 0.03, 0.14, 6),
      placed(0, RIM_Y + 0.05, side * OARLOCK_Z),
    );
  }

  // A coil of rope in the bow, the rope it was lashed with.
  builder.add(
    rope,
    new THREE.TorusGeometry(0.1, 0.028, 5, 10),
    placed(1.05, -0.12, 0, { x: Math.PI / 2 }),
  );

  const built = builder.build();
  const oars = ([1, -1] as const).map((side) => createOar(side, planking, trim));
  for (const oar of oars) built.group.add(oar.pivot);
  const setRowing = (stroke: number | null, pulling = true): void => {
    for (const oar of oars) {
      if (stroke === null) shipOar(oar);
      else swingOar(oar, stroke, pulling);
    }
  };
  setRowing(null);

  return {
    group: built.group,
    setRowing,
    dispose: () => {
      built.dispose();
      for (const oar of oars) for (const geometry of oar.geometries) geometry.dispose();
    },
  };
}

/** Where the oarlock stands across the boat, in metres from its middle line. */
const OARLOCK_Z = HALF_BEAM - WALL / 2 - 0.02;
/** The oarlock's height above the waterline, where an oar turns. */
const OARLOCK_Y = RIM_Y + 0.06;
/** How far an oar reaches inboard of the oarlock, and out over the side to the blade's end. */
const OAR_INBOARD = 0.5;
const OAR_OUTBOARD = 1.4;
/** How far the blade sweeps either way of straight out, and how deep it dips on the power stroke. */
const STROKE_SWEEP = 0.5;
const STROKE_DIP = 0.34;
/** How far it tips on the way back, clear of the water. */
const STROKE_RAISED = 0.18;
/** Where the blade rests, skimming just above the water, when gliding. */
const GLIDE_DIP = 0.13;

interface Oar {
  /** Which side of the boat it is on: 1 to starboard, -1 to port. */
  readonly side: 1 | -1;
  /** Turns about the oarlock; the oar's length runs along its own Z with the blade at +Z. */
  readonly pivot: THREE.Group;
  readonly geometries: readonly THREE.BufferGeometry[];
}

function createOar(
  side: 1 | -1,
  bladeMaterial: THREE.Material,
  shaftMaterial: THREE.Material,
): Oar {
  const shaftLength = OAR_INBOARD + OAR_OUTBOARD - 0.4;
  const shaft = new THREE.CylinderGeometry(0.022, 0.022, shaftLength, 6);
  shaft.rotateX(Math.PI / 2);
  shaft.translate(0, 0, shaftLength / 2 - OAR_INBOARD);
  const blade = new THREE.BoxGeometry(0.11, 0.015, 0.4);
  blade.translate(0, 0, OAR_OUTBOARD - 0.2);

  const pivot = new THREE.Group();
  pivot.rotation.order = 'YXZ';
  for (const [geometry, material] of [
    [shaft, shaftMaterial],
    [blade, bladeMaterial],
  ] as const) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    pivot.add(mesh);
  }
  return { side, pivot, geometries: [shaft, blade] };
}

/** Laid along the bottom of the boat, blade towards the stern. */
function shipOar(oar: Oar): void {
  oar.pivot.position.set(0.55, -0.1, oar.side * 0.3);
  // Local +Z (the blade) turned to point at -X, the stern.
  oar.pivot.rotation.set(0, -Math.PI / 2, 0);
}

/** Out over the side, the blade sweeping fore and aft and dipping in on the power stroke. */
function swingOar(oar: Oar, stroke: number, pulling: boolean): void {
  const turn = stroke * Math.PI * 2;
  // Forward at the start of the stroke, drawn back through the middle of it.
  const sweep = pulling ? STROKE_SWEEP * Math.cos(turn) : 0.15;
  const dip = pulling
    ? STROKE_RAISED + (STROKE_DIP - STROKE_RAISED) * Math.max(0, Math.sin(turn))
    : GLIDE_DIP;
  oar.pivot.position.set(0, OARLOCK_Y, oar.side * OARLOCK_Z);
  // A turn of the whole oar about the oarlock: starboard's blade points out
  // to +Z, port's to -Z, and a positive sweep carries either one forward.
  oar.pivot.rotation.set(dip, oar.side === 1 ? sweep : Math.PI - sweep, 0);
}
