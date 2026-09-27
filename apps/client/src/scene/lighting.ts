import * as THREE from 'three/webgpu';

import { dayBrightness } from '@acorn/shared';

const DAY_SKY = new THREE.Color(0x9fc4d8);
const NIGHT_SKY = new THREE.Color(0x0d1830);

const DAY_HEMI_SKY = new THREE.Color(0xcfe3f0);
const NIGHT_HEMI_SKY = new THREE.Color(0x1c2c4d);
const DAY_HEMI_GROUND = new THREE.Color(0x51603f);
const NIGHT_HEMI_GROUND = new THREE.Color(0x11141c);
const DAY_HEMI_INTENSITY = 1.6;
const NIGHT_HEMI_INTENSITY = 0.5;

const DAY_SUN_COLOR = new THREE.Color(0xfff0d4);
const NIGHT_SUN_COLOR = new THREE.Color(0x9fb4e0);
const DAY_SUN_INTENSITY = 2.1;
const NIGHT_SUN_INTENSITY = 0.5;

// Fog stays the same distance at night - a cycle is meant to be watched, not
// to quietly shrink how far a player can see.
const FOG_NEAR = 55;
const FOG_FAR = 120;

/** Behind a room seen from inside a home: a warm, dark backdrop, like the edge of a stage. */
const INDOOR_BACKDROP = new THREE.Color(0x1d1712);

export interface DaylightRig {
  readonly sun: THREE.DirectionalLight;
  /** Recolour the sky and lights for a point in the day: 0 and 1 are midnight, 0.5 is noon. */
  update(progress: number): void;
  /**
   * Inside a home (see decision 0055): no sky and no fog behind the room,
   * just a dark backdrop, while the daylight itself carries on through the
   * windows and the open top of the dollhouse view.
   */
  setIndoors(indoors: boolean): void;
}

/** Soft daylight over the clearing, fog so the tree line fades out, and a day/night cycle over both. */
export function addDaylight(scene: THREE.Scene): DaylightRig {
  const background = new THREE.Color();
  scene.background = background;
  const fog = new THREE.Fog(DAY_SKY.getHex(), FOG_NEAR, FOG_FAR);
  scene.fog = fog;

  const sky = new THREE.HemisphereLight(DAY_HEMI_SKY, DAY_HEMI_GROUND, DAY_HEMI_INTENSITY);
  scene.add(sky);

  const sun = new THREE.DirectionalLight(DAY_SUN_COLOR, DAY_SUN_INTENSITY);
  sun.position.set(28, 40, 18);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 140;
  sun.shadow.camera.left = -55;
  sun.shadow.camera.right = 55;
  sun.shadow.camera.top = 55;
  sun.shadow.camera.bottom = -55;
  sun.shadow.bias = -0.0008;
  scene.add(sun);
  scene.add(sun.target);

  let indoors = false;
  let lastProgress = 0.5;

  function update(progress: number): void {
    lastProgress = progress;
    const brightness = dayBrightness(progress);

    if (indoors) background.copy(INDOOR_BACKDROP);
    else background.lerpColors(NIGHT_SKY, DAY_SKY, brightness);
    fog.color.copy(background);

    sky.color.lerpColors(NIGHT_HEMI_SKY, DAY_HEMI_SKY, brightness);
    sky.groundColor.lerpColors(NIGHT_HEMI_GROUND, DAY_HEMI_GROUND, brightness);
    sky.intensity = THREE.MathUtils.lerp(NIGHT_HEMI_INTENSITY, DAY_HEMI_INTENSITY, brightness);

    // Doubles as moonlight at night, rather than modelling a separate moon -
    // a placeholder to replace once this is fun enough to deserve real art.
    sun.color.lerpColors(NIGHT_SUN_COLOR, DAY_SUN_COLOR, brightness);
    sun.intensity = THREE.MathUtils.lerp(NIGHT_SUN_INTENSITY, DAY_SUN_INTENSITY, brightness);
  }

  update(0.5);
  return {
    sun,
    update,
    setIndoors(next) {
      indoors = next;
      scene.fog = next ? null : fog;
      update(lastProgress);
    },
  };
}
