import * as THREE from 'three/webgpu';
import {
  attribute,
  dot,
  max,
  mix,
  normalWorld,
  positionLocal,
  positionWorld,
  smoothstep,
  uniform,
  vec3,
  vertexColor,
} from 'three/tsl';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

import { DEFAULT_WORLD_SEED } from '@acorn/shared';

import ashPeakUrl from '@assets/terrain/ash-peak.glb?url';

import {
  ASH_PEAK,
  RIDGE_LAYERS,
  alpenglow,
  ridgeCrest,
  showingThrough,
  skylineClarity,
  type RidgeLayer,
} from '../art/skyline-shape';

/**
 * The far country (decision 0286): a sky that deepens overhead, three rings of
 * blue forested ridges, and Ash Peak standing over the lake.
 *
 * Fog hides the real forest beyond about 120 m, so none of this is fogged. It
 * is coloured from the sky's own horizon colour instead: each piece is its own
 * colour mixed towards the haze by how far away it is and by the weather, and
 * every piece melts into the haze at its foot. That keeps it sitting behind
 * the fogged tree line rather than in front of it.
 *
 * It stands still in the world, far outside it, so walking across the map
 * slides the near ridges past the far ones a little, as real distance does.
 */

const DOME_RADIUS = 3200;

const RIDGE_DAY: Record<RidgeLayer['name'], number> = {
  near: 0x2f4f49,
  middle: 0x3b5d62,
  far: 0x4f6d7c,
};
/** How much air is in front of each ridge on a clear day: 0 is none, 1 hides it. */
const RIDGE_AIR: Record<RidgeLayer['name'], number> = { near: 0.3, middle: 0.5, far: 0.66 };
/** How far each piece is, 0 to 1, for how soon weather hides it. */
const RIDGE_DISTANCE: Record<RidgeLayer['name'], number> = { near: 0, middle: 0.3, far: 0.6 };
/** The heights between which each ridge rises out of the haze at its foot. */
const RIDGE_HAZE: Record<RidgeLayer['name'], readonly [number, number]> = {
  near: [-25, 30],
  middle: [-10, 85],
  far: [0, 150],
};

/** What the horizon colour is multiplied by to get the sky straight overhead. */
const ZENITH_DAY = new THREE.Color().setRGB(0.42, 0.6, 0.92);
const ZENITH_NIGHT = new THREE.Color().setRGB(0.3, 0.36, 0.6);
const SNOWY_FOREST = new THREE.Color(0xa9bcc6);
const SNOW_DAY = new THREE.Color(0xeef3f8);
const SNOW_NIGHT = new THREE.Color(0x394a66);
const GLOW = new THREE.Color(0xff7a5c);
const PEAK_LIGHT_DAY = new THREE.Color(0xfffaf0);
const PEAK_LIGHT_NIGHT = new THREE.Color(0x364869);
const PEAK_SHADE_DAY = new THREE.Color(0x9db2d8);
const PEAK_SHADE_NIGHT = new THREE.Color(0x1b2640);
/** Where Ash Peak's light comes from: low from the south-west, so its face is side-lit. */
const PEAK_SUN = new THREE.Vector3(0.2, 0.55, 0.81).normalize();

export interface SkylineState {
  /** The colour of the sky at the horizon, which is also the colour of the fog. */
  readonly haze: THREE.Color;
  /** 0 is midnight, 1 is noon. */
  readonly daylight: number;
  /** How much of the sky is rain cloud, 0 to 1. */
  readonly cloud: number;
  /** 1 in a blizzard, easing in and out. */
  readonly whiteout: number;
  /** 1 deep underground. */
  readonly underground: number;
  /** How snowed-in the season is, 0 to 1. */
  readonly snow: number;
}

export interface Skyline {
  readonly group: THREE.Group;
  /** Settles once Ash Peak's model has loaded and joined the scene. */
  readonly ready: Promise<void>;
  update(state: SkylineState): void;
  dispose(): void;
}

interface RidgeDraw {
  readonly layer: RidgeLayer;
  readonly mesh: THREE.Mesh;
  readonly body: THREE.Color;
  readonly snow: THREE.Color;
  readonly snowLine: { value: number };
  readonly snowAmount: { value: number };
  readonly strength: { value: number };
}

/** One ridge: a tall ribbon round the world whose top edge is the crest. */
function ridgeGeometry(seed: number, layer: RidgeLayer): THREE.BufferGeometry {
  const crest = ridgeCrest(seed, layer);
  const count = layer.segments;
  const positions = new Float32Array((count + 1) * 2 * 3);
  const ragged = new Float32Array((count + 1) * 2);
  for (let i = 0; i <= count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const height = crest[i % count]!;
    const x = Math.cos(angle) * layer.radius;
    const z = Math.sin(angle) * layer.radius;
    // The foot is well below the ground, for the view down from a summit.
    positions.set([x, -120, z, x, height, z], i * 6);
    // The snow line wanders up and down along the ridge instead of running level.
    const wander = Math.sin(angle * 37 + layer.radius) * 0.6 + Math.sin(angle * 91) * 0.4;
    ragged.set([wander, wander], i * 2);
  }
  const index: number[] = [];
  for (let i = 0; i < count; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('ragged', new THREE.BufferAttribute(ragged, 1));
  geometry.setIndex(index);
  return geometry;
}

export function createSkyline(seed: number = DEFAULT_WORLD_SEED): Skyline {
  const group = new THREE.Group();
  group.name = 'skyline';
  const owned: THREE.Mesh<THREE.BufferGeometry, THREE.Material>[] = [];

  const haze = uniform(new THREE.Color());
  const zenith = uniform(new THREE.Color());

  // The sky: the horizon colour low down, deepening overhead.
  const domeMaterial = new THREE.MeshBasicNodeMaterial();
  domeMaterial.fog = false;
  domeMaterial.side = THREE.BackSide;
  domeMaterial.colorNode = mix(
    haze,
    zenith,
    smoothstep(0.04, 0.8, positionLocal.y.div(DOME_RADIUS)),
  );
  const dome = new THREE.Mesh(new THREE.SphereGeometry(DOME_RADIUS, 32, 24), domeMaterial);
  dome.name = 'sky-dome';
  dome.frustumCulled = false;
  group.add(dome);
  owned.push(dome);

  const ridges: RidgeDraw[] = RIDGE_LAYERS.map((layer) => {
    const body = new THREE.Color();
    const snow = new THREE.Color();
    const snowLine = uniform(1000);
    const snowAmount = uniform(0);
    const strength = uniform(1);
    const material = new THREE.MeshBasicNodeMaterial();
    material.fog = false;
    material.side = THREE.DoubleSide;
    const height = positionWorld.y;
    // Snow lies on whatever stands above the snow line.
    const capFoot = snowLine.add(attribute('ragged', 'float').mul(20));
    const cap = smoothstep(0, 9, height.sub(capFoot)).mul(snowAmount);
    const [hazeFoot, hazeTop] = RIDGE_HAZE[layer.name];
    const risen = smoothstep(hazeFoot, hazeTop, height);
    material.colorNode = mix(haze, mix(uniform(body), uniform(snow), cap), risen.mul(strength));
    const mesh = new THREE.Mesh(ridgeGeometry(seed, layer), material);
    mesh.name = `ridge-${layer.name}`;
    mesh.frustumCulled = false;
    group.add(mesh);
    owned.push(mesh);
    return { layer, mesh, body, snow, snowLine, snowAmount, strength };
  });

  // Ash Peak, lit by its own low sun so its ridges and glaciers read from afar.
  const peakLight = new THREE.Color();
  const peakShade = new THREE.Color();
  const peakGlow = new THREE.Color();
  const peakStrength = uniform(1);
  const peakMaterial = new THREE.MeshBasicNodeMaterial();
  peakMaterial.fog = false;
  const painted = vertexColor().rgb;
  const lit = max(dot(normalWorld, uniform(PEAK_SUN)), 0);
  const snowy = smoothstep(0.3, 0.62, dot(painted, vec3(0.3, 0.5, 0.2)));
  const shaded = painted
    .mul(mix(uniform(peakShade), uniform(peakLight), lit))
    .add(uniform(peakGlow).mul(snowy).mul(lit.mul(0.75).add(0.25)));
  const peakRisen = smoothstep(40, ASH_PEAK.height * 0.5, positionWorld.y);
  peakMaterial.colorNode = mix(haze, shaded, peakRisen.mul(peakStrength));

  let disposed = false;
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const ready = loader
    .loadAsync(ashPeakUrl)
    .then((gltf) => {
      if (disposed) return;
      // The model keeps its own node, which holds the scale its packed-down points need.
      const peak = gltf.scene;
      peak.name = 'ash-peak';
      peak.scale.setScalar(ASH_PEAK.scale);
      // Sunk a little, so its foot is never seen standing on nothing.
      peak.position.set(ASH_PEAK.x, -30, ASH_PEAK.z);
      // Turned so the shoulder peak shows on the skyline from the lake.
      peak.rotation.y = 2.2;
      peak.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        (child.material as THREE.Material).dispose();
        child.material = peakMaterial;
        child.frustumCulled = false;
        owned.push(child as THREE.Mesh<THREE.BufferGeometry, THREE.Material>);
      });
      group.add(peak);
    })
    .catch((error: unknown) => {
      // The game is whole without its backdrop mountain; say so and carry on.
      console.warn('Ash Peak could not be loaded', error);
    });

  const scratch = new THREE.Color();

  return {
    group,
    ready,
    update(state) {
      const clarity = skylineClarity(state);
      group.visible = clarity > 0.002;
      if (!group.visible) return;
      const day = THREE.MathUtils.clamp(state.daylight, 0, 1);
      const snow = THREE.MathUtils.clamp(state.snow, 0, 1);
      const glow = alpenglow(day) * clarity;
      haze.value.copy(state.haze);

      // Overhead: a deeper blue by day, nearly black at night, flat grey under cloud.
      zenith.value
        .copy(state.haze)
        .multiply(scratch.copy(ZENITH_NIGHT).lerp(ZENITH_DAY, day))
        .lerp(state.haze, 1 - showingThrough(clarity, 0.2));

      for (const ridge of ridges) {
        const name = ridge.layer.name;
        // At night a ridge is only a darker shape against the sky.
        scratch.copy(state.haze).multiplyScalar(0.5);
        ridge.body
          .setHex(RIDGE_DAY[name])
          .lerp(SNOWY_FOREST, snow * 0.55)
          .lerp(scratch, 1 - day);
        ridge.snow
          .copy(SNOW_NIGHT)
          .lerp(SNOW_DAY, day)
          .lerp(GLOW, glow * 0.3);
        ridge.strength.value =
          (1 - RIDGE_AIR[name]) * showingThrough(clarity, RIDGE_DISTANCE[name]);
        if (name === 'far') {
          ridge.snowAmount.value = 1;
          ridge.snowLine.value = THREE.MathUtils.lerp(238, 150, snow);
        } else if (name === 'middle') {
          ridge.snowAmount.value = snow;
          ridge.snowLine.value = 120;
        } else {
          ridge.snowAmount.value = 0;
        }
      }

      peakLight.copy(PEAK_LIGHT_NIGHT).lerp(PEAK_LIGHT_DAY, day);
      peakShade.copy(PEAK_SHADE_NIGHT).lerp(PEAK_SHADE_DAY, day);
      peakGlow.copy(GLOW).multiplyScalar(glow * 0.5);
      peakStrength.value = 0.8 * showingThrough(clarity, 1);
    },
    dispose() {
      disposed = true;
      group.removeFromParent();
      for (const { geometry, material } of owned) {
        geometry.dispose();
        material.dispose();
      }
    },
  };
}
