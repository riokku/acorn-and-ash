import {
  rumorRoute,
  rumorStage,
  type DiscoverySite,
  type ExpeditionState,
  type Terrain,
} from '@acorn/shared';
import { createBuriedCacheMound } from './buried-cache';

/** Personal cache uses the established buried-supplies model and reserved landmark ground. */
export function createRumorCache(terrain: Terrain) {
  const mound = createBuriedCacheMound();
  mound.group.name = 'rumor-hidden-bundle';
  mound.group.visible = false;
  return {
    ...mound,
    update(state: Readonly<ExpeditionState>, sites: readonly DiscoverySite[]) {
      const site = rumorRoute(state, sites)[2];
      mound.group.visible = rumorStage(state) === 2 && site !== undefined;
      if (site) mound.group.position.set(site.x, terrain.heightAt(site.x, site.z), site.z);
    },
  };
}
