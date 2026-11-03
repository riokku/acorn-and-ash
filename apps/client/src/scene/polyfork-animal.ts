import * as THREE from 'three/webgpu';
import { smoothstep } from '@acorn/shared';

import { instantiateAnimatedModel, loadAnimatedModel, type AnimatedModel } from './model-loading';

/**
 * A free Polyfork animal (decision 0272), downloaded at build time into
 * public/polyfork. It brings its own skeleton and Idle, Walk and Run clips;
 * animal-motion.ts still tilts it to the ground and plays its alert and defeat.
 */
export interface PolyforkAnimal {
  /** Fetches the animal up front. Idempotent, like the other model preloads. */
  preload(): Promise<void>;
  /**
   * A living copy, or undefined to keep drawing the placeholder. `size` is
   * how much bigger the caller will draw it, so its gait keeps pace.
   */
  create(size?: number): AnimatedAnimal | undefined;
}

export interface AnimatedAnimal {
  readonly group: THREE.Group;
  /**
   * Plays its own gait at this speed (m/s). `flying`, from 0 to 1, blends
   * in its Fly clip, for the birds that have one.
   */
  animate(deltaSeconds: number, speed: number, flying?: number): void;
  dispose(): void;
}

export interface Gait {
  /** The speeds (m/s) the walk and run clips look right at, at this scale. */
  walkSpeed: number;
  runSpeed: number;
  /** Grown or shrunk evenly from the file's size. */
  scale?: number;
  /** The run clip's name, when it isn't 'Run' (Quaternius calls it 'Gallop'). */
  runClip?: string;
  /** The flying clip, for a bird that has one. */
  flyClip?: string;
}

export function polyforkAnimal(file: string, gait: Gait): PolyforkAnimal {
  return riggedAnimal(`${import.meta.env.BASE_URL}polyfork/${file}.glb`, file, gait);
}

/**
 * Any rigged animal with Idle, Walk and Run clips that faces +Z, like
 * Polyfork's and Quaternius's: the same handling, from any address.
 */
export function riggedAnimal(url: string, file: string, gait: Gait): PolyforkAnimal {
  let template: AnimatedModel | undefined;
  let loading: Promise<void> | null = null;
  return {
    preload() {
      loading ??= loadAnimatedModel(url).then(
        (loaded) => {
          template = loaded;
        },
        (error: unknown) => {
          // The placeholder is a fine fallback, so a missing download
          // shouldn't empty the forest of this animal.
          console.error(`Could not load the ${file} model; keeping the placeholder.`, error);
        },
      );
      return loading;
    },
    create(size = 1) {
      if (template === undefined) return undefined;
      // A bigger animal's stride is longer, so each clip looks right at a faster speed.
      const walkSpeed = gait.walkSpeed * size;
      const runSpeed = gait.runSpeed * size;
      const { root, mixer, actions } = instantiateAnimatedModel(template);
      // The file faces +Z; every creature here faces -Z before it is turned.
      root.rotation.y = Math.PI;
      root.scale.setScalar(gait.scale ?? 1);
      root.traverse((child) => {
        if (child instanceof THREE.Mesh) child.castShadow = true;
      });
      const group = new THREE.Group();
      group.add(root);

      const clip = (name: string) => actions.find((action) => action.getClip().name === name);
      const idle = clip('Idle');
      const walk = clip('Walk');
      const run = clip(gait.runClip ?? 'Run');
      const fly = gait.flyClip === undefined ? undefined : clip(gait.flyClip);
      for (const action of [idle, walk, run, fly]) action?.play();
      fly?.setEffectiveWeight(0);

      return {
        group,
        animate(deltaSeconds, speed, flying = 0) {
          const moving = smoothstep(speed, 0.05, 0.5);
          const running = smoothstep(speed, walkSpeed * 1.8, walkSpeed * 3.6);
          const grounded = fly === undefined ? 1 : 1 - flying;
          idle?.setEffectiveWeight((1 - moving) * grounded);
          walk?.setEffectiveWeight(moving * (1 - running) * grounded);
          run?.setEffectiveWeight(moving * running * grounded);
          fly?.setEffectiveWeight(flying);
          walk?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / walkSpeed, 0.5, 1.8));
          run?.setEffectiveTimeScale(THREE.MathUtils.clamp(speed / runSpeed, 0.6, 1.5));
          mixer.update(deltaSeconds);
        },
        dispose: () => mixer.stopAllAction(),
      };
    },
  };
}
