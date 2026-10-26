import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as THREE from 'three/webgpu';
import { expect, it } from 'vitest';
import { HOMESTEAD_PROJECTS, BUILDABLE_KINDS, placedPropColliders } from '@acorn/shared';
import { HomesteadPlan } from '../src/hud/HomesteadPlan';
import { HudStore } from '../src/hud/store';
import { createHomesteadProject } from '../src/scene/homestead-project';
import { triangleCount } from '../src/art/shapes';
import { craftMenuEntries } from '../src/hud/craft-menu';
it('guides a new homeowner to useful projects and derives completion from placed pieces', () => {
  const state = new HudStore().getSnapshot();
  const start = renderToStaticMarkup(createElement(HomesteadPlan, { state }));
  expect(start).toContain('First, place a tent');
  expect(start).toContain('0/3 projects');
  const done = {
    ...state,
    homeKind: 'tent' as const,
    homesteadProjects: HOMESTEAD_PROJECTS.map((p) => p.kind),
  };
  const html = renderToStaticMarkup(createElement(HomesteadPlan, { state: done }));
  expect(html).toContain('Trailstead established');
  expect(html).toContain('3/3 projects');
  expect(html).toContain('Ten extra private');
  const entries = craftMenuEntries(done).filter(
    (e) =>
      e.action.kind === 'build' &&
      HOMESTEAD_PROJECTS.map((p) => p.kind as string).includes(e.action.buildable),
  );
  expect(entries).toHaveLength(3);
  expect(entries.every((e) => e.locked)).toBe(true);
});
it('reuses the cabin objects at the origin with solid footprints and stays within budgets', () => {
  for (const { kind } of HOMESTEAD_PROJECTS) {
    const model = createHomesteadProject(kind);
    try {
      const box = new THREE.Box3().setFromObject(model.group);
      expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x))).toBeLessThanOrEqual(
        BUILDABLE_KINDS[kind].footprintRadius,
      );
      expect(Math.max(Math.abs(box.min.z), Math.abs(box.max.z))).toBeLessThanOrEqual(
        BUILDABLE_KINDS[kind].footprintRadius,
      );
      expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
      expect(triangleCount(model.group)).toBeLessThanOrEqual(BUILDABLE_KINDS[kind].triangleBudget);
      expect(placedPropColliders({ kind, x: 0, z: 0, yaw: 0 }, 0).length).toBeGreaterThan(0);
    } finally {
      model.dispose();
    }
  }
});
it('keeps indoor building locked while allowing already built projects to count', () => {
  const state = {
    ...new HudStore().getSnapshot(),
    homeKind: 'cabin' as const,
    home: { yours: true, locked: false },
    carrying: [
      { item: 'log' as const, count: 18 },
      { item: 'stick' as const, count: 16 },
      { item: 'rope' as const, count: 2 },
      { item: 'flower' as const, count: 3 },
    ],
  };
  const html = renderToStaticMarkup(createElement(HomesteadPlan, { state }));
  expect(html.match(/Step outside to build/g)).toHaveLength(3);
});
