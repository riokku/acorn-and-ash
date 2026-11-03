import * as THREE from 'three/webgpu';
import captainHelmUrl from '@assets/gear/last-watch-helm.glb?url';
import type { ItemId } from '@acorn/shared';
import { loadAnimatedModel, type AnimatedModel } from './model-loading';
import knightHelmetUrl from '@assets/gear/knight-helmet.glb?url';
import mageHatUrl from '@assets/gear/mage-hat.glb?url';
import bearHatUrl from '@assets/gear/barbarian-bear-hat.glb?url';
import rogueMaskUrl from '@assets/gear/rogue-mask.glb?url';
import woolCapUrl from '@assets/gear/wool-cap.glb?url';
import wornWatchHelmUrl from '@assets/gear/last-watch-helm-worn.glb?url';

/** Every helm a player can wear, fitted to the soft bodies' skeleton (decision 0282). */
const URLS: Readonly<Partial<Record<ItemId, string>>> = {
  watchCaptainHelm: wornWatchHelmUrl,
  knightHelmet: knightHelmetUrl,
  mageHat: mageHatUrl,
  bearHat: bearHatUrl,
  rogueMask: rogueMaskUrl,
  woolCap: woolCapUrl,
};
const templates = new Map<ItemId, AnimatedModel>();
/** The Last Watch helm on its own, for the captain's head and for one lying on the ground. */
let captainHelm: AnimatedModel | undefined;
let pending: Promise<void> | null = null;
/** Head gear lives in separate exported assets, not in the plain character bodies. */
export function preloadWornGearModels(): Promise<void> {
  const load = async (name: string, url: string, keep: (model: AnimatedModel) => void) => {
    try {
      keep(await loadAnimatedModel(url));
    } catch (error) {
      console.error(`Could not load worn gear "${name}".`, error);
    }
  };
  pending ??= Promise.all([
    ...Object.entries(URLS).map(([item, url]) =>
      load(item, url, (model) => templates.set(item as ItemId, model)),
    ),
    load('captain helm', captainHelmUrl, (model) => (captainHelm = model)),
  ]).then(() => {});
  return pending;
}
export function wornGearModelTemplate(item: ItemId): AnimatedModel | undefined {
  return templates.get(item === 'kingCrown' ? 'watchCaptainHelm' : item);
}

/** A rigid head-bone attachment: the exported helm as the captain wears it. */
export function createWatchCaptainHelm(): THREE.Group | null {
  const root = captainHelm?.root.clone(true);
  if (!root) return null;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return root;
}
