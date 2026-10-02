import * as THREE from 'three/webgpu';

/**
 * Firelight, for everything that burns: the campfire, the lantern, a
 * carried torch, and the hearth and lamp inside a home.
 *
 * Three.js builds every material's shader around the exact lights in the
 * scene, so a light appearing or going - a campfire lit or put out, a torch
 * taken out, a lantern built - rebuilt every shader in view at once: a
 * freeze of up to a second (see decision 0062). So nothing that burns owns
 * a light of its own. It owns a `FireGlow` instead - a marker where its fire
 * is, with the colour, brightness and reach its light should have - and a
 * fixed set of real lights, `FireLights`, put into the scene once and never
 * taken out, is moved onto the glows nearest the camera every frame.
 *
 * No shadow on any of them: a shadow-casting light per campfire, lantern and
 * torch in a room full of players would add up fast, and the flicker reads
 * fine without one.
 */
export interface FireGlow {
  /**
   * Where the fire is: put it in the burning thing's own group. Hidden, or
   * anywhere outside the scene, it lights nothing.
   */
  readonly anchor: THREE.Object3D;
  /** Scales its brightness, flicker and all: 1 as made. */
  brightness: number;
  update(deltaSeconds: number): void;
  /** For good: it never lights anything again. */
  dispose(): void;
}

/**
 * How many fires can light the scene at once - the nearest to the camera.
 * Every material pays for each of these on every pixel, lit or not, so it
 * is kept to what a busy evening at home needs: a campfire, a few lanterns
 * and a torch or two.
 */
export const FIRE_LIGHT_COUNT = 6;

/** Two layered waves, so the wobble doesn't read as a single metronomic pulse. */
const FLICKER_SPEED_A = 11;
const FLICKER_SPEED_B = 27;
/** How far intensity swings from its base, as a fraction of it. */
const FLICKER_STRENGTH = 0.22;

/** A glow's own state, as `FireLights` reads it. */
interface Glow {
  readonly anchor: THREE.Object3D;
  readonly color: THREE.Color;
  readonly distance: number;
  /** Its brightness right now, flicker and all. */
  intensity(): number;
  /** Where it is in the world, as of the last `FireLights.update`. */
  readonly at: THREE.Vector3;
  /** How near the camera is to what it lights; lowest wins a light. */
  nearness: number;
}

/** Every glow there is, in any scene: `FireLights` picks out its own scene's. */
const glows = new Set<Glow>();
const anchors = new WeakSet<THREE.Object3D>();

/**
 * A fire's glow, wobbling over time the way real firelight does unless
 * `flicker` is 0 - a lamp's steady flame.
 */
export function createFireGlow(
  color: THREE.ColorRepresentation,
  intensity: number,
  distance: number,
  flicker = FLICKER_STRENGTH,
): FireGlow {
  const anchor = new THREE.Object3D();
  anchor.name = 'fire-glow';
  anchors.add(anchor);
  // Staggered per glow, so a row of torches or lanterns doesn't pulse in lockstep.
  let elapsed = Math.random() * 100;
  let wobble = 0;
  const glow: Glow = {
    anchor,
    color: new THREE.Color(color),
    distance,
    intensity: () => intensity * handle.brightness * (1 + wobble * flicker),
    at: new THREE.Vector3(),
    nearness: 0,
  };
  glows.add(glow);

  const handle: FireGlow = {
    anchor,
    brightness: 1,
    update(deltaSeconds) {
      elapsed += deltaSeconds;
      wobble =
        Math.sin(elapsed * FLICKER_SPEED_A) * 0.6 + Math.sin(elapsed * FLICKER_SPEED_B + 1.7) * 0.4;
    },
    dispose() {
      glows.delete(glow);
    },
  };
  return handle;
}

/** Whether this is a glow's anchor - for a build preview, which should light nothing. */
export function isFireGlow(object: THREE.Object3D): boolean {
  return anchors.has(object);
}

/**
 * The real lights every glow borrows: always `FIRE_LIGHT_COUNT` of them in
 * the scene, so the set of lights - and so every shader - never changes.
 * One not needed this frame is simply turned down to nothing.
 */
export class FireLights {
  private readonly lights: THREE.PointLight[] = [];
  private readonly lit: Glow[] = [];

  constructor(private readonly scene: THREE.Scene) {
    for (let i = 0; i < FIRE_LIGHT_COUNT; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 1);
      light.name = 'fire-light';
      this.lights.push(light);
      scene.add(light);
    }
  }

  /** Puts this frame's lights on the glows nearest `viewer`, in the world. */
  update(viewer: THREE.Vector3): void {
    const lit = this.lit;
    lit.length = 0;
    for (const glow of glows) {
      if (!shownIn(glow.anchor, this.scene)) continue;
      if (glow.intensity() <= 0) continue;
      glow.anchor.getWorldPosition(glow.at);
      // How far the camera is from the edge of what it lights.
      glow.nearness = glow.at.distanceTo(viewer) - glow.distance;
      lit.push(glow);
    }
    lit.sort((a, b) => a.nearness - b.nearness);
    for (const [index, light] of this.lights.entries()) {
      const glow = lit[index];
      if (glow === undefined) {
        light.intensity = 0;
        continue;
      }
      light.position.copy(glow.at);
      light.color.copy(glow.color);
      light.intensity = glow.intensity();
      light.distance = glow.distance;
    }
  }
}

/** Whether `object` is somewhere in `scene`, and nothing on the way up is hidden. */
function shownIn(object: THREE.Object3D, scene: THREE.Scene): boolean {
  let at: THREE.Object3D | null = object;
  while (at !== null) {
    if (!at.visible) return false;
    if (at === scene) return true;
    at = at.parent;
  }
  return false;
}
