import * as THREE from 'three/webgpu';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import {
  DEFAULT_WORLD_SEED,
  SUNREACH_SURVEY,
  SUNREACH_EXPEDITION_ID,
  createWildernessTerrain,
  emptyExpedition,
} from '@acorn/shared';
import { createSurveyScenery } from '../src/scene/sunreach-survey';
import { createHomeDecoration } from '../src/scene/home-decoration';
import { SunreachTrail } from '../src/hud/SunreachTrail';
import { HudStore } from '../src/hud/store';
it('grounds the vault and reuses a fully visible, solid pennant figure', () => {
  const terrain = createWildernessTerrain(DEFAULT_WORLD_SEED);
  const model = createSurveyScenery(terrain);
  const pennant = createHomeDecoration('sunreachPennant');
  try {
    const vault = model.group.children[2]!;
    const site = SUNREACH_SURVEY[2];
    expect(vault.position.toArray()).toEqual([site.x, terrain.heightAt(site.x, site.z), site.z]);
    expect(
      new THREE.Box3().setFromObject(pennant.group).getSize(new THREE.Vector3()).y,
    ).toBeGreaterThan(1.4);
  } finally {
    model.dispose();
    pennant.dispose();
  }
});
it('shows the next clue and shovel requirement only outdoors in Sunreach', () => {
  const state = {
    ...new HudStore().getSnapshot(),
    position: { ...SUNREACH_SURVEY[2], y: 21 },
    expedition: {
      ...emptyExpedition(),
      active: SUNREACH_EXPEDITION_ID,
      progress: [1, 1, 0],
      offers: [0, 11, 8],
      notice: 'none' as const,
    },
  };
  const html = renderToStaticMarkup(createElement(SunreachTrail, { state }));
  expect(html).toContain('Crown Mesa');
  expect(html).toContain('Equip a shovel');
  expect(
    renderToStaticMarkup(
      createElement(SunreachTrail, { state: { ...state, position: { x: 0, y: 0, z: 0 } } }),
    ),
  ).toBe('');
});
