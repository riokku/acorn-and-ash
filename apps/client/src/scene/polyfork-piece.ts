import * as THREE from 'three/webgpu';

import { loadNamedGeometries } from './model-loading';

/**
 * A simple, unanimated Polyfork model (decision 0272), downloaded at build
 * time into public/polyfork. Each one is loaded once and shared by every copy
 * in the world; until it arrives, or if the download is missing, `parts()`
 * is undefined and the caller keeps building its placeholder.
 */
export interface PolyforkPiece {
  /** Each mesh in the file by name, already fitted to the game. */
  parts(): ReadonlyMap<string, THREE.BufferGeometry> | undefined;
}

const everyPiece: Array<() => Promise<void>> = [];

/** Polyfork paints with vertex colours, so one material serves every piece. */
const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });

/**
 * Registers `public/polyfork/<file>.glb`. `fit` moves it into the game's
 * conventions (turned, scaled or stretched to a placeholder's footprint).
 */
export function polyforkPiece(file: string, fit?: THREE.Matrix4): PolyforkPiece {
  let parts: Map<string, THREE.BufferGeometry> | undefined;
  let loading: Promise<void> | null = null;
  everyPiece.push(() => {
    loading ??= loadNamedGeometries(`${import.meta.env.BASE_URL}polyfork/${file}.glb`).then(
      (loaded) => {
        if (fit !== undefined) for (const geometry of loaded.values()) geometry.applyMatrix4(fit);
        parts = loaded;
      },
      (error: unknown) => {
        console.error(`Could not load the ${file} model; keeping the placeholder.`, error);
      },
    );
    return loading;
  });
  return { parts: () => parts };
}

/** Fetches every registered piece up front. Idempotent, like the other model preloads. */
export function preloadPolyforkPieces(): Promise<void> {
  return Promise.all(everyPiece.map((load) => load())).then(() => undefined);
}

/** A placeable copy of some of a piece's meshes. The geometry is shared, so disposing frees nothing. */
export function polyforkGroup(
  name: string,
  geometries: Iterable<THREE.BufferGeometry>,
): { group: THREE.Group; dispose(): void } {
  const group = new THREE.Group();
  group.name = name;
  for (const geometry of geometries) {
    const mesh = new THREE.Mesh(geometry, paint);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return { group, dispose: () => undefined };
}
