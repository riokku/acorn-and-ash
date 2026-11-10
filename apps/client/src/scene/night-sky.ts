import * as THREE from 'three/webgpu';
import {
  attribute,
  float,
  length,
  mix,
  positionWorld,
  sin,
  smoothstep,
  sqrt,
  uniform,
  uv,
  vec2,
} from 'three/tsl';

import {
  PLAIN_NIGHT,
  SKY_POLE,
  moonLit,
  moonDirection,
  moonGlow,
  skyTurn,
  starField,
  starlight,
  type Star,
  type Tonight,
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

/** Shooting stars streak just inside the stars. */
const METEOR_DISTANCE = 2950;
/** How long the tail is, as a share of the whole path, and how wide the head. */
const METEOR_TAIL = 0.45;
const METEOR_WIDTH = 9;
const METEOR_COLOUR = new THREE.Color(0xeaf2ff);

/** The northern lights hang in the north, between the ridges and the stars. */
const AURORA_DISTANCE = 2750;
/** How far either side of north the curtain reaches, and how high, in radians. */
const AURORA_HALF_WIDTH = (75 * Math.PI) / 180;
const AURORA_FOOT = (11 * Math.PI) / 180;
const AURORA_TOP = (40 * Math.PI) / 180;
const AURORA_FOLDS = 72;
const AURORA_GREEN = new THREE.Color(0x4dffa6);
const AURORA_VIOLET = new THREE.Color(0x9a6bff);

export interface NightSkyState {
  /** 0 and 1 are midnight, 0.5 is noon. */
  readonly dayProgress: number;
  /** 0 is midnight, 1 is noon. */
  readonly daylight: number;
  /** How clearly the far country shows, 0 (lost in cloud) to 1 (see `skylineClarity`). */
  readonly clarity: number;
  /** The moon's phase and anything else in the sky tonight; a plain full-moon night if left out. */
  readonly tonight?: Tonight;
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

/**
 * The northern lights' curtain: a tall ribbon across the north, in flat
 * upright folds whose feet rise and dip along its length.
 */
function auroraGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const index: number[] = [];
  for (let i = 0; i <= AURORA_FOLDS; i++) {
    const along = i / AURORA_FOLDS;
    // North is -z; the curtain swings from north-west round to north-east.
    const turn = (along * 2 - 1) * AURORA_HALF_WIDTH;
    const dip = Math.sin(along * 9.4) * 0.035 + Math.sin(along * 23 + 1.3) * 0.015;
    for (const top of [0, 1]) {
      const height = (top === 1 ? AURORA_TOP : AURORA_FOOT) + dip * (top === 1 ? 1.6 : 1);
      const flat = Math.cos(height) * AURORA_DISTANCE;
      positions.push(
        Math.sin(turn) * flat,
        Math.sin(height) * AURORA_DISTANCE,
        -Math.cos(turn) * flat,
      );
      uvs.push(along, top);
    }
    if (i < AURORA_FOLDS) {
      const first = i * 2;
      index.push(first, first + 2, first + 1, first + 1, first + 2, first + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
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
  // The phase: the edge of the lit part is half an ellipse down the face.
  // `shadowEdge` runs from 1 (new, nothing lit) to -1 (full); `litSide` is 1
  // while the moon waxes (lit on the right) and -1 while it wanes.
  const shadowEdge = uniform(-1);
  const litSide = uniform(1);
  const rim = sqrt(float(1).sub(fromMiddle.y.mul(fromMiddle.y)).max(0));
  const lit = smoothstep(-0.02, 0.02, fromMiddle.x.mul(litSide).sub(shadowEdge.mul(rim)));
  discMaterial.opacityNode = moonStrength.mul(lit);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(MOON_RADIUS, 20), discMaterial);
  disc.frustumCulled = false;
  disc.renderOrder = -1;
  moon.add(disc);

  // -- shooting stars -------------------------------------------------------
  // One streak, moved to wherever the shooting star of the moment is: bright
  // at the head and fading to nothing down the tail.
  const meteorStrength = uniform(0);
  const meteorMaterial = new THREE.MeshBasicNodeMaterial();
  meteorMaterial.fog = false;
  meteorMaterial.transparent = true;
  meteorMaterial.depthWrite = false;
  meteorMaterial.side = THREE.DoubleSide;
  meteorMaterial.blending = THREE.AdditiveBlending;
  meteorMaterial.colorNode = uniform(METEOR_COLOUR).mul(uv().x).mul(uv().x).mul(meteorStrength);
  const meteorGeometry = new THREE.BufferGeometry();
  const meteorPositions = new THREE.BufferAttribute(new Float32Array(9), 3);
  meteorGeometry.setAttribute('position', meteorPositions);
  // A long thin triangle: the point is the tail's end, the short side the head.
  meteorGeometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0.5, 1, 0, 1, 1], 2));
  const meteor = new THREE.Mesh(meteorGeometry, meteorMaterial);
  meteor.name = 'shooting-star';
  meteor.frustumCulled = false;
  meteor.renderOrder = -3;
  meteor.visible = false;
  group.add(meteor);
  const head = new THREE.Vector3();
  const tail = new THREE.Vector3();
  const from = new THREE.Vector3();
  const to = new THREE.Vector3();
  const side = new THREE.Vector3();

  // -- the northern lights --------------------------------------------------
  const auroraStrength = uniform(0);
  const auroraMaterial = new THREE.MeshBasicNodeMaterial();
  auroraMaterial.fog = false;
  auroraMaterial.transparent = true;
  auroraMaterial.depthWrite = false;
  auroraMaterial.side = THREE.DoubleSide;
  auroraMaterial.blending = THREE.AdditiveBlending;
  const along = uv().x;
  const up = uv().y;
  // Slow upright rays that drift along the curtain, some bright and some dim.
  const drift = clock.mul(0.05);
  const rays = sin(
    along
      .mul(61)
      .add(drift.mul(3))
      .add(sin(along.mul(9).sub(drift)).mul(2.5)),
  )
    .mul(0.5)
    .add(0.5);
  const swell = sin(along.mul(5.5).sub(drift.mul(1.7)))
    .mul(0.5)
    .add(0.5);
  // Brightest just above its foot, thinning away upwards, and fading out at both ends.
  const rise = smoothstep(0, 0.12, up).mul(float(1).sub(up)).mul(float(1).sub(up));
  const ends = smoothstep(0, 0.18, along).mul(smoothstep(0, 0.18, float(1).sub(along)));
  auroraMaterial.colorNode = mix(
    uniform(AURORA_GREEN),
    uniform(AURORA_VIOLET),
    smoothstep(0.15, 0.85, up),
  )
    .mul(rays.mul(0.65).add(0.35))
    .mul(swell.mul(0.6).add(0.4))
    .mul(rise)
    .mul(ends)
    .mul(auroraStrength);
  const aurora = new THREE.Mesh(auroraGeometry(), auroraMaterial);
  aurora.name = 'northern-lights';
  aurora.frustumCulled = false;
  aurora.renderOrder = -2;
  aurora.visible = false;
  group.add(aurora);

  const towardsMoon = new THREE.Vector3();
  const middle = new THREE.Vector3(0, 0, 0);
  const owned = [stars, halo, disc, meteor, aurora];

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

      const night = state.tonight ?? PLAIN_NIGHT;
      const litShare = moonLit(night.moonPhase);
      moon.visible = moonOut * risen > 0.003 && litShare > 0.01;
      moonStrength.value = moonOut * risen;
      shadowEdge.value = Math.cos(night.moonPhase * Math.PI * 2);
      litSide.value = night.moonPhase <= 0.5 ? 1 : -1;
      // A thin moon throws a thin glow.
      halo.scale.setScalar(0.45 + 0.55 * litShare);
      towardsMoon.set(where.x, where.y, where.z);
      moon.position.copy(towardsMoon).multiplyScalar(MOON_DISTANCE);
      moon.lookAt(middle);

      const falling = night.meteor;
      meteor.visible = falling !== null && starsOut > 0.2;
      if (falling !== null && meteor.visible) {
        from.set(falling.from.x, falling.from.y, falling.from.z);
        to.set(falling.to.x, falling.to.y, falling.to.z);
        head.lerpVectors(from, to, falling.progress).normalize();
        tail.lerpVectors(from, to, Math.max(0, falling.progress - METEOR_TAIL)).normalize();
        side
          .crossVectors(head, tail)
          .normalize()
          .multiplyScalar(METEOR_WIDTH / 2);
        head.multiplyScalar(METEOR_DISTANCE);
        tail.multiplyScalar(METEOR_DISTANCE);
        meteorPositions.setXYZ(0, tail.x, tail.y, tail.z);
        meteorPositions.setXYZ(1, head.x + side.x, head.y + side.y, head.z + side.z);
        meteorPositions.setXYZ(2, head.x - side.x, head.y - side.y, head.z - side.z);
        meteorPositions.needsUpdate = true;
        // It flares up, then burns out as it goes; none show near the horizon.
        const burn = Math.sin(Math.PI * Math.min(1, falling.progress * 1.15));
        const clearOfGround = THREE.MathUtils.smoothstep(head.y / METEOR_DISTANCE, 0.08, 0.25);
        meteorStrength.value = starsOut * falling.brightness * burn * clearOfGround * 1.6;
      }

      const lights = night.aurora * starsOut;
      aurora.visible = lights > 0.003;
      auroraStrength.value = lights * 0.55;
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
