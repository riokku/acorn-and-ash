import * as THREE from 'three/webgpu';

import { loadNamedGeometries } from './model-loading';

/**
 * Polyfork's free Wooden Canoe (decision 0272), downloaded at build time into
 * public/polyfork. Only its hull is used: the game keeps its own paddle,
 * which the paddler swings.
 */
const CANOE_URL = `${import.meta.env.BASE_URL}polyfork/wooden-canoe.glb`;

/**
 * Polyfork builds the canoe 4.2 m long and 0.9 m wide along +Z. Fit it to the
 * hull the boat rules were tuned for (3.34 m by 0.84 m, bow along +X) so the
 * paddler's seat, paddle and collision still line up.
 */
const LENGTH_SCALE = 3.34 / 4.2;
const BEAM_SCALE = 0.84 / 0.9;
/** Lift so its inner floor sits just above the water, keeping the water out of the boat. */
const SINK = -0.04;

let hull: THREE.BufferGeometry | undefined;
let material: THREE.MeshStandardMaterial | undefined;
let preloadPromise: Promise<void> | null = null;

/** Fetches the canoe up front. Idempotent, like the other model preloads. */
export function preloadCanoeModel(): Promise<void> {
  preloadPromise ??= load();
  return preloadPromise;
}

/** The real hull and its material, or undefined to keep drawing the placeholder canoe. */
export function canoeHullPart():
  { geometry: THREE.BufferGeometry; material: THREE.Material } | undefined {
  return hull && material ? { geometry: hull, material } : undefined;
}

async function load(): Promise<void> {
  try {
    const geometry = (await loadNamedGeometries(CANOE_URL)).get('hull');
    if (geometry === undefined) throw new Error('the canoe has no "hull" mesh');
    geometry.applyMatrix4(
      new THREE.Matrix4()
        .makeTranslation(0, SINK, 0)
        .multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2))
        .multiply(new THREE.Matrix4().makeScale(BEAM_SCALE, LENGTH_SCALE, LENGTH_SCALE)),
    );
    hull = geometry;
    // Polyfork paints with vertex colours on one shared material.
    material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  } catch (error) {
    // The placeholder canoe is a fine fallback, so a missing download
    // shouldn't stop anyone from getting on the water.
    console.error('Could not load the canoe model; keeping the placeholder.', error);
  }
}
