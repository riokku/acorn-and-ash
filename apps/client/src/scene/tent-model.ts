import * as THREE from 'three/webgpu';

import { loadNamedGeometries } from './model-loading';

/**
 * Polyfork's free Camp Tent (decision 0272), downloaded at build time into
 * public/polyfork. It is one shell with an open front, painted with vertex
 * colours; shelter.ts keeps its own doormat and entrance lantern around it.
 */
const TENT_URL = `${import.meta.env.BASE_URL}polyfork/camp-tent.glb`;

/** Polyfork builds it 2.98 m long with the door on +Z, the way our homes face. */
const MODEL_LENGTH = 2.98;

let shell: THREE.BufferGeometry | undefined;
let material: THREE.MeshStandardMaterial | undefined;
let preloadPromise: Promise<void> | null = null;

/** Fetches the tent up front. Idempotent, like the other model preloads. */
export function preloadTentModel(): Promise<void> {
  preloadPromise ??= load();
  return preloadPromise;
}

/**
 * A copy of the real tent, door centred on x = 0 and squeezed front to back
 * to fit `length`, or undefined to keep building the placeholder canvas.
 */
export function createTentModel(length: number): THREE.Mesh | undefined {
  if (shell === undefined || material === undefined) return undefined;
  const mesh = new THREE.Mesh(shell, material);
  mesh.name = 'camp-tent';
  mesh.scale.set(1, 1, length / MODEL_LENGTH);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

async function load(): Promise<void> {
  try {
    const geometry = (await loadNamedGeometries(TENT_URL)).get('camp-tent-shell');
    if (geometry === undefined) throw new Error('the tent has no "camp-tent-shell" mesh');
    shell = geometry;
    // The open flaps are single-sided canvas, so draw both faces.
    material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      side: THREE.DoubleSide,
    });
  } catch (error) {
    // The placeholder canvas tent is a fine fallback, so a missing download
    // shouldn't leave anyone without a home.
    console.error('Could not load the tent model; keeping the placeholder.', error);
  }
}
