import { flameModelTemplate } from './campfire-models';
import { instantiateAnimatedModel } from './model-loading';

let nextPhase = 0;

/** Shared authored fire, with independent timing and consistent accessibility/lifetime handling. */
export function createFlame() {
  const template = flameModelTemplate();
  if (!template) return null;
  const instance = instantiateAnimatedModel(template);
  const { root, mixer, actions } = instance;
  const preference =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  for (const action of actions) action.play();
  // A non-integer step avoids matching neighboring fires even with short clips.
  mixer.setTime(nextPhase++ * 0.731);
  let disposed = false;
  return {
    root,
    update(deltaSeconds: number, reducedMotion = preference?.matches ?? false) {
      if (disposed || reducedMotion || !root.visible || !Number.isFinite(deltaSeconds)) return;
      // Do not leap through a whole burn cycle after a suspended browser tab.
      mixer.update(Math.max(0, Math.min(deltaSeconds, 0.1)));
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      mixer.stopAllAction();
      mixer.uncacheRoot(root);
      root.removeFromParent();
      // Geometry, morph buffers and materials belong to the loaded template.
    },
  };
}
