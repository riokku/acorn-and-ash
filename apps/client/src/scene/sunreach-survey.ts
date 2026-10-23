import * as THREE from 'three/webgpu';
import { SUNREACH_REMNANTS, SUNREACH_NOTES, SUNREACH_SURVEY, type Terrain } from '@acorn/shared';
import { createEncounterLandmarks } from './encounter-sites';
import { createDiscoveryLandmarks } from './discovery-sites';
import { createBuriedCacheMound } from './buried-cache';

/** Existing ruin, notes, cairn and buried-supplies art arranged as a survey trail. */
export function createSurveyScenery(terrain: Terrain) {
  const remnants = createEncounterLandmarks(SUNREACH_REMNANTS, terrain);
  const notes = createDiscoveryLandmarks(SUNREACH_NOTES, terrain);
  const vault = createBuriedCacheMound();
  const at = SUNREACH_SURVEY[2];
  vault.group.position.set(at.x, terrain.heightAt(at.x, at.z), at.z);
  const group = new THREE.Group();
  group.name = 'sunreach-survey';
  group.add(remnants.group, notes.group, vault.group);
  return {
    group,
    dispose() {
      remnants.dispose();
      notes.dispose();
      vault.dispose();
    },
  };
}
