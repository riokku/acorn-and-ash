import * as THREE from 'three/webgpu';

/**
 * A warm point light whose intensity wobbles over time the way real
 * firelight does. Shared by everything that burns: the campfire, the
 * lantern and a carried torch. No shadow of its own - a shadow-casting
 * light per campfire, lantern and torch in a room full of players would
 * add up fast, and the flicker reads fine without one.
 */
export interface FlickerLight {
  readonly light: THREE.PointLight;
  update(deltaSeconds: number): void;
}

/** Two layered waves, so the wobble doesn't read as a single metronomic pulse. */
const FLICKER_SPEED_A = 11;
const FLICKER_SPEED_B = 27;
/** How far intensity swings from its base, as a fraction of it. */
const FLICKER_STRENGTH = 0.22;

export function createFlickerLight(
  color: THREE.ColorRepresentation,
  intensity: number,
  distance: number,
): FlickerLight {
  const light = new THREE.PointLight(color, intensity, distance);
  // Staggered per light, so a row of torches or lanterns doesn't pulse in lockstep.
  let elapsed = Math.random() * 100;

  return {
    light,
    update(deltaSeconds) {
      elapsed += deltaSeconds;
      const wobble =
        Math.sin(elapsed * FLICKER_SPEED_A) * 0.6 + Math.sin(elapsed * FLICKER_SPEED_B + 1.7) * 0.4;
      light.intensity = intensity * (1 + wobble * FLICKER_STRENGTH);
    },
  };
}
