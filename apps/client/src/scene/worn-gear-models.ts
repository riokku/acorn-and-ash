import type { ItemId } from '@acorn/shared';
import { loadAnimatedModel, type AnimatedModel } from './model-loading';
import knightHelmetUrl from '@assets/gear/knight-helmet.glb?url';
import mageHatUrl from '@assets/gear/mage-hat.glb?url';
import bearHatUrl from '@assets/gear/barbarian-bear-hat.glb?url';
import rogueMaskUrl from '@assets/gear/rogue-mask.glb?url';

const URLS: Readonly<Partial<Record<ItemId, string>>> = {
  knightHelmet: knightHelmetUrl,
  mageHat: mageHatUrl,
  bearHat: bearHatUrl,
  rogueMask: rogueMaskUrl,
};
const templates = new Map<ItemId, AnimatedModel>();
let pending: Promise<void> | null = null;
/** Head gear lives in separate exported assets, not in the plain character bodies. */
export function preloadWornGearModels(): Promise<void> {
  pending ??= Promise.all(
    Object.entries(URLS).map(async ([item, url]) => {
      try {
        templates.set(item as ItemId, await loadAnimatedModel(url));
      } catch (error) {
        console.error(`Could not load worn gear "${item}".`, error);
      }
    }),
  ).then(() => {});
  return pending;
}
export function wornGearModelTemplate(item: ItemId): AnimatedModel | undefined {
  return templates.get(item);
}
