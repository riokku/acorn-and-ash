import * as THREE from 'three/webgpu';
import { smoothstep } from '@acorn/shared';

import { instantiateAnimatedModel, loadAnimatedModel, type AnimatedModel } from './model-loading';

/**
 * Polyfork's free Forest Rabbit (decision 0272), downloaded at build time into
 * public/polyfork. It brings its own skeleton and Idle, Walk and Run clips, so
 * its legs and ears move; animal-motion.ts still tilts it to the ground and
 * plays its alert and defeat.
 */
const RABBIT_URL = `${import.meta.env.BASE_URL}polyfork/forest-rabbit.glb`;

/** The speeds (m/s) the clips look right at: a wandering rabbit's and a fleeing one's. */
const WALK_SPEED = 1.1;
const RUN_SPEED = 6;

let template: AnimatedModel | undefined;
let preloadPromise: Promise<void> | null = null;

/** Fetches the rabbit up front. Idempotent, like the other model preloads. */
export function preloadRabbitModel(): Promise<void> {
  preloadPromise ??= load();
  return preloadPromise;
}

/** A living copy of the real rabbit, or undefined to keep drawing the placeholder. */
export function createRabbitModel():
  | { group: THREE.Group; animate(deltaSeconds: number, speed: number): void; dispose(): void }
  | undefined {
  if (template === undefined) return undefined;
  const { root, mixer, actions } = instantiateAnimatedModel(template);
  // Polyfork faces +Z; every creature here faces -Z before it is turned.
  root.rotation.y = Math.PI;
  root.traverse((child) => {
    if (child instanceof THREE.Mesh) child.castShadow = true;
  });
  const group = new THREE.Group();
  group.add(root);

  const clip = (name: string) => actions.find((action) => action.getClip().name === name);
  const idle = clip('Idle');
  const walk = clip('Walk');
  const run = clip('Run');
  for (const action of [idle, walk, run]) action?.play();

  return {
    group,
    animate(deltaSeconds, speed) {
      const moving = smoothstep(speed, 0.05, 0.5);
      const running = smoothstep(speed, 2, 4);
      idle?.setEffectiveWeight(1 - moving);
      walk?.setEffectiveWeight(moving * (1 - running));
      run?.setEffectiveWeight(moving * running);
      walk?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / WALK_SPEED, 0.5, 1.8));
      run?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / RUN_SPEED, 0.6, 1.5));
      mixer.update(deltaSeconds);
    },
    dispose: () => mixer.stopAllAction(),
  };
}

async function load(): Promise<void> {
  try {
    template = await loadAnimatedModel(RABBIT_URL);
  } catch (error) {
    // The placeholder rabbit is a fine fallback, so a missing download
    // shouldn't stop the forest from having rabbits in it.
    console.error('Could not load the rabbit model; keeping the placeholder.', error);
  }
}
