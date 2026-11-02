import * as THREE from 'three/webgpu';

import { loadNamedGeometries } from './model-loading';
import { splitByPaint } from './polyfork-piece';

/**
 * Polyfork's free Lantern Post (decision 0272), downloaded at build time into
 * public/polyfork. Its glass is painted on, so it is cut out here as its own
 * piece: lantern.ts gives it the amber, fern or moonlit glow and a real light.
 */
const LANTERN_URL = `${import.meta.env.BASE_URL}polyfork/lantern-post.glb`;

/** Polyfork's post stands 2.4 m; shrink it evenly to our garden lantern's height so it fits indoors. */
const MODEL_HEIGHT = 2.4;
const TARGET_HEIGHT = 1.42;
/** The cream the glass panes are painted in. */
const GLASS_PAINT = new THREE.Color(0.939, 0.896, 0.839);

export interface LanternModelParts {
  /** The post, arm and the lantern's iron frame, painted with vertex colours. */
  readonly frame: THREE.BufferGeometry[];
  readonly glass: THREE.BufferGeometry;
  readonly material: THREE.Material;
  /** The middle of the glass, where the light goes. */
  readonly glassCentre: THREE.Vector3;
}

let parts: LanternModelParts | undefined;
let preloadPromise: Promise<void> | null = null;

/** Fetches the lantern up front. Idempotent, like the other model preloads. */
export function preloadLanternModel(): Promise<void> {
  preloadPromise ??= load();
  return preloadPromise;
}

/** The real lantern's pieces, or undefined to keep building the placeholder. */
export function lanternModelParts(): LanternModelParts | undefined {
  return parts;
}

async function load(): Promise<void> {
  try {
    const pieces = await loadNamedGeometries(LANTERN_URL);
    const post = pieces.get('post-frame');
    const head = pieces.get('lantern-head');
    if (post === undefined || head === undefined)
      throw new Error('the lantern has no "post-frame" or "lantern-head" mesh');
    // Polyfork's arm reaches along +Z; ours reaches along +X.
    const shrink = TARGET_HEIGHT / MODEL_HEIGHT;
    const fit = new THREE.Matrix4()
      .makeRotationY(Math.PI / 2)
      .multiply(new THREE.Matrix4().makeScale(shrink, shrink, shrink));
    post.applyMatrix4(fit);
    head.applyMatrix4(fit);
    const [ironwork, glass] = splitByPaint(head, GLASS_PAINT);
    glass.computeBoundingBox();
    parts = {
      frame: [post, ironwork],
      glass,
      material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
      glassCentre: glass.boundingBox!.getCenter(new THREE.Vector3()),
    };
  } catch (error) {
    // The placeholder lantern is a fine fallback, so a missing download
    // shouldn't leave anyone's garden dark.
    console.error('Could not load the lantern model; keeping the placeholder.', error);
  }
}
