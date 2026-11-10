import * as THREE from 'three/webgpu';
import {
  attribute,
  float,
  length,
  mix,
  positionWorld,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
} from 'three/tsl';

import {
  SKY_POLE,
  moonDirection,
  moonGlow,
  skyTurn,
  starField,
  starlight,
  type Star,
} from '../art/night-sky';
import { showingThrough } from '../art/skyline-shape';

/**
 * The night sky (decision 0290), drawn inside the sky dome and behind the far
 * ridges and Ash Peak, which hide whatever passes behind them.
 *
 * Every star is a small diamond, to sit with the faceted trees and rocks, and
 * all of them are one piece that turns slowly about the pole star. They are
 * added to the sky's own colour, so they fade out on their own as the sky
 * lightens, and they dim towards the horizon where the air is thickest.
 */

/** How far out the stars and the moon hang: inside the sky dome, beyond Ash Peak. */
const STAR_DISTANCE = 3000;
const MOON_DISTANCE = 2900;
/** The smallest and largest a star is drawn, in metres across at that distance. */
const STAR_SMALLEST = 5.5;
const STAR_LARGEST = 17;
/** The moon is drawn about six times its real width, as a storybook moon is. */
const MOON_RADIUS = 84;
const HALO_RADIUS = 520;

const COOL_STAR = new THREE.Color(0xa9c4ff);
const WHITE_STAR = new THREE.Color(0xf4f6ff);
const WARM_STAR = new THREE.Color(0xffd9a0);
const MOON_LIGHT = new THREE.Color(0xf6f1df);
const MOON_SEAS = new THREE.Color(0xc3c6c4);
const HALO = new THREE.Color(0x8fa6d6);

export interface NightSkyState {
  /** 0 and 1 are midnight, 0.5 is noon. */
  readonly dayProgress: number;
  /** 0 is midnight, 1 is noon. */
  readonly daylight: number;
  /** How clearly the far country shows, 0 (lost in cloud) to 1 (see `skylineClarity`). */
  readonly clarity: number;
}

export interface NightSky {
  readonly group: THREE.Group;
  update(state: NightSkyState): void;
  dispose(): void;
}

/** All the stars as one piece: a diamond each, facing the middle of the world. */
function starGeometry(stars: readonly Star[]): THREE.BufferGeometry {
  const positions = new Float32Array(stars.length * 4 * 3);
  const colours = new Float32Array(stars.length * 4 * 3);
  const twinkles = new Float32Array(stars.length * 4);
  const index: number[] = [];
  const out = new THREE.Vector3();
  const across = new THREE.Vector3();
  const up = new THREE.Vector3();
  const corner = new THREE.Vector3();
  const colour = new THREE.Color();
  const spare = new THREE.Vector3(0, 1, 0);

  stars.forEach((star, i) => {
    out.set(star.x, star.y, star.z);
    // Two directions square to the line of sight, to lay the diamond out in.
    across.crossVectors(out, Math.abs(star.y) > 0.95 ? spare.set(1, 0, 0) : spare.set(0, 1, 0));
    across.normalize();
    up.crossVectors(out, across);
    const half = THREE.MathUtils.lerp(STAR_SMALLEST, STAR_LARGEST, star.size) / 2;
    const corners: readonly [number, number][] = [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ];
    if (star.warmth < 0) colour.copy(WHITE_STAR).lerp(COOL_STAR, -star.warmth);
    else colour.copy(WHITE_STAR).lerp(WARM_STAR, star.warmth);
    colour.multiplyScalar(star.brightness);
    corners.forEach(([a, u], c) => {
      corner
        .copy(out)
        .multiplyScalar(STAR_DISTANCE)
        .addScaledVector(across, a * half)
        .addScaledVector(up, u * half);
      positions.set([corner.x, corner.y, corner.z], (i * 4 + c) * 3);
      colours.set([colour.r, colour.g, colour.b], (i * 4 + c) * 3);
      twinkles[i * 4 + c] = star.twinkle;
    });
    const first = i * 4;
    index.push(first, first + 1, first + 2, first, first + 2, first + 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('starColour', new THREE.BufferAttribute(colours, 3));
  geometry.setAttribute('twinkle', new THREE.BufferAttribute(twinkles, 1));
  geometry.setIndex(index);
  return geometry;
}

export function createNightSky(seed: number): NightSky {
  const group = new THREE.Group();
  group.name = 'night-sky';

  // -- the stars ------------------------------------------------------------
  const starStrength = uniform(0);
  const clock = uniform(0);
  const starMaterial = new THREE.MeshBasicNodeMaterial();
  starMaterial.fog = false;
  starMaterial.transparent = true;
  starMaterial.depthWrite = false;
  starMaterial.side = THREE.DoubleSide;
  starMaterial.blending = THREE.AdditiveBlending;
  // Each star keeps its own slow time, so no two brighten together.
  const phase = attribute('twinkle', 'float');
  const shimmer = sin(clock.mul(phase.mul(1.3).add(0.7)).add(phase.mul(40)))
    .mul(0.22)
    .add(0.82);
  // Thick air low down: nothing shows right on the horizon.
  const clearOfHorizon = smoothstep(0.02, 0.3, positionWorld.y.div(STAR_DISTANCE));
  starMaterial.colorNode = attribute('starColour', 'vec3')
    .mul(shimmer)
    .mul(clearOfHorizon)
    .mul(starStrength);
  const stars = new THREE.Mesh(starGeometry(starField(seed)), starMaterial);
  stars.name = 'stars';
  stars.frustumCulled = false;
  stars.renderOrder = -3;
  group.add(stars);
  const pole = new THREE.Vector3(SKY_POLE.x, SKY_POLE.y, SKY_POLE.z);

  // -- the moon -------------------------------------------------------------
  const moon = new THREE.Group();
  moon.name = 'moon';
  group.add(moon);

  const moonStrength = uniform(0);
  const fromMiddle = uv().sub(vec2(0.5, 0.5)).mul(2);

  // A soft light in the air round it.
  const haloMaterial = new THREE.MeshBasicNodeMaterial();
  haloMaterial.fog = false;
  haloMaterial.transparent = true;
  haloMaterial.depthWrite = false;
  haloMaterial.blending = THREE.AdditiveBlending;
  const falloff = float(1).sub(length(fromMiddle)).max(0);
  haloMaterial.colorNode = uniform(HALO)
    .mul(falloff.mul(falloff).mul(falloff))
    .mul(moonStrength)
    .mul(0.5);
  const halo = new THREE.Mesh(
    new THREE.PlaneGeometry(HALO_RADIUS * 2, HALO_RADIUS * 2),
    haloMaterial,
  );
  halo.frustumCulled = false;
  halo.renderOrder = -2;
  moon.add(halo);

  // The moon itself: a pale disc with three darker seas, hard-edged like a paper cut-out.
  const discMaterial = new THREE.MeshBasicNodeMaterial();
  discMaterial.fog = false;
  discMaterial.transparent = true;
  discMaterial.depthWrite = false;
  const sea = (x: number, y: number, radius: number) =>
    float(1).sub(smoothstep(radius - 0.03, radius, length(fromMiddle.sub(vec2(x, y)))));
  const seas = sea(-0.32, 0.3, 0.3)
    .max(sea(0.22, 0.42, 0.2))
    .max(sea(0.18, -0.28, 0.26));
  discMaterial.colorNode = mix(uniform(MOON_LIGHT), uniform(MOON_SEAS), seas);
  discMaterial.opacityNode = moonStrength;
  const disc = new THREE.Mesh(new THREE.CircleGeometry(MOON_RADIUS, 20), discMaterial);
  disc.frustumCulled = false;
  disc.renderOrder = -1;
  moon.add(disc);

  const towardsMoon = new THREE.Vector3();
  const middle = new THREE.Vector3(0, 0, 0);
  const owned = [stars, halo, disc];

  return {
    group,
    update(state) {
      const clear = showingThrough(state.clarity, 1);
      const starsOut = starlight(state.daylight) * clear;
      const moonOut = moonGlow(state.daylight) * showingThrough(state.clarity, 0.5);
      const where = moonDirection(state.dayProgress);
      // Low on the horizon the moon is lost in the same thick air as the stars.
      const risen = THREE.MathUtils.smoothstep(where.y, -0.02, 0.1);

      stars.visible = starsOut > 0.003;
      starStrength.value = starsOut;
      // Slow enough to be a shimmer, not a flicker.
      clock.value = (performance.now() / 1000) % 3600;
      stars.quaternion.setFromAxisAngle(pole, skyTurn(state.dayProgress));

      moon.visible = moonOut * risen > 0.003;
      moonStrength.value = moonOut * risen;
      towardsMoon.set(where.x, where.y, where.z);
      moon.position.copy(towardsMoon).multiplyScalar(MOON_DISTANCE);
      moon.lookAt(middle);
    },
    dispose() {
      group.removeFromParent();
      for (const { geometry, material } of owned) {
        geometry.dispose();
        material.dispose();
      }
    },
  };
}
