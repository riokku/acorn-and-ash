import * as THREE from 'three/webgpu';

import { paintedMaterial, plainMaterial } from '../art/materials';
import { ModelBuilder, placed, plankGeometry, stoneGeometry } from '../art/shapes';
import { createFlickerLight } from './fire-light';

/**
 * A garden lantern (see decision 0053): a stained timber post set on a
 * stone, with an arm holding out a small iron lantern whose glass glows
 * warm. Always lit once built - no fuel and no switch, the same "atmosphere
 * only" choice the campfire's own fire already made (see decision 0033) -
 * and it casts real, flickering light from inside the glass.
 */
export interface Lantern {
  readonly group: THREE.Group;
  update(deltaSeconds: number): void;
  dispose(): void;
}

const POST_HEIGHT = 1.35;
const POST_WIDTH = 0.09;
const ARM_LENGTH = 0.32;
/** Where the lantern hangs from the end of the arm. */
const HANG_X = ARM_LENGTH - 0.04;
const GLASS_HEIGHT = 0.16;
const GLASS_WIDTH = 0.12;
const GLASS_Y = POST_HEIGHT - 0.24;

/** Smaller and closer than the campfire's - a garden lantern, not a bonfire. */
const LANTERN_LIGHT_COLOR = 0xffce7a;
const LANTERN_LIGHT_INTENSITY = 6;
const LANTERN_LIGHT_DISTANCE = 5;

export function createLantern(): Lantern {
  const timber = paintedMaterial('wood', { tint: 0x9b7658, roughness: 0.85 });
  const stone = paintedMaterial('stone', { roughness: 1, flatShading: true });
  const iron = plainMaterial(0x2f2a26, { roughness: 0.55, flatShading: true });
  const glass = plainMaterial(0xffe3a8, {
    roughness: 0.25,
    emissive: 0xffa93f,
    emissiveIntensity: 1.6,
  });

  const builder = new ModelBuilder();
  builder
    // A flat stone the post stands on.
    .add(stone, stoneGeometry(0.2, 0.08, 301, 0.5, 0), placed(0, -0.01, 0))
    .add(
      timber,
      plankGeometry(POST_WIDTH, POST_HEIGHT, POST_WIDTH, 'y', 0.9, 302),
      placed(0, POST_HEIGHT / 2, 0),
    )
    // A little pyramid cap keeps the rain off the post's end grain.
    .add(
      timber,
      new THREE.ConeGeometry(0.075, 0.07, 4),
      placed(0, POST_HEIGHT + 0.035, 0, { y: Math.PI / 4 }),
    )
    .add(
      timber,
      plankGeometry(ARM_LENGTH, 0.06, 0.06, 'x', 0.9, 303),
      placed(ARM_LENGTH / 2, POST_HEIGHT - 0.06, 0),
    )
    // A brace under the arm.
    .add(
      timber,
      plankGeometry(0.2, 0.04, 0.04, 'x', 0.9, 304),
      placed(0.08, POST_HEIGHT - 0.14, 0, { z: Math.PI / 4 }),
    );

  // The lantern itself, hanging from a ring under the end of the arm.
  const top = GLASS_Y + GLASS_HEIGHT / 2;
  const bottom = GLASS_Y - GLASS_HEIGHT / 2;
  builder
    .add(
      iron,
      new THREE.TorusGeometry(0.025, 0.006, 4, 8),
      placed(HANG_X, POST_HEIGHT - 0.12, 0, { y: Math.PI / 2 }),
    )
    .add(
      iron,
      new THREE.ConeGeometry(0.11, 0.07, 4),
      placed(HANG_X, top + 0.035, 0, { y: Math.PI / 4 }),
    )
    .add(
      iron,
      plankGeometry(GLASS_WIDTH + 0.03, 0.02, GLASS_WIDTH + 0.03, 'x', 1, 0),
      placed(HANG_X, bottom - 0.01, 0),
    )
    .add(
      glass,
      plankGeometry(GLASS_WIDTH, GLASS_HEIGHT, GLASS_WIDTH, 'y', 1, 0),
      placed(HANG_X, GLASS_Y, 0),
    );
  for (const dx of [-1, 1]) {
    for (const dz of [-1, 1]) {
      builder.add(
        iron,
        plankGeometry(0.014, GLASS_HEIGHT + 0.01, 0.014, 'y', 1, 0),
        placed(HANG_X + (dx * GLASS_WIDTH) / 2, GLASS_Y, (dz * GLASS_WIDTH) / 2),
      );
    }
  }

  const model = builder.build();
  const fireLight = createFlickerLight(
    LANTERN_LIGHT_COLOR,
    LANTERN_LIGHT_INTENSITY,
    LANTERN_LIGHT_DISTANCE,
  );
  fireLight.light.position.set(HANG_X, GLASS_Y, 0);
  model.group.add(fireLight.light);

  return {
    group: model.group,
    update: (deltaSeconds) => fireLight.update(deltaSeconds),
    dispose: model.dispose,
  };
}
