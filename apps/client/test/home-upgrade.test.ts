import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { learnHome } from '@acorn/shared';
import { HomeUpgrade } from '../src/hud/HomeUpgrade';
import { HudStore } from '../src/hud/store';

const render = (state: ReturnType<HudStore['getSnapshot']>) =>
  renderToStaticMarkup(createElement(HomeUpgrade, { state, onUpgrade: () => {} }));

it('combines pack and saved home supplies without letting an excess resource hide another shortfall', () => {
  const state = {
    ...new HudStore().getSnapshot(),
    homeKind: 'tent' as const,
    homeSkills: learnHome(0, 'teepee'),
    carrying: [{ item: 'log' as const, count: 10 }],
    homeStoredSupplies: [
      { item: 'log' as const, count: 30 },
      { item: 'stick' as const, count: 8 },
    ],
  };
  const html = render(state);
  expect(html).toContain('71% of materials');
  expect(html).toContain('10 in pack · 30 stored · ready');
  expect(html).toContain('0 in pack · 8 stored · find 8 more');
  expect(html).toContain('Keep bringing supplies home');
  expect(html).toContain('disabled');
});

it('keeps blueprint and indoors gates separate from having enough materials', () => {
  const state = {
    ...new HudStore().getSnapshot(),
    homeKind: 'tent' as const,
    carrying: [
      { item: 'log' as const, count: 12 },
      { item: 'stick' as const, count: 16 },
    ],
  };
  expect(render(state)).toContain('100% of materials');
  expect(render(state)).toContain('Blueprint needed');
  state.homeSkills = learnHome(0, 'teepee');
  expect(render(state)).toContain('Preview your home upgrade');
  expect(render(state)).not.toContain('disabled');
  expect(render({ ...state, home: { yours: true, locked: false } })).toContain('Step outside');
});

it('uses only carried supplies before placing a home and celebrates the final shelter without another purchase', () => {
  const state = {
    ...new HudStore().getSnapshot(),
    homeStoredSupplies: [{ item: 'stick' as const, count: 99 }],
  };
  expect(render(state)).toContain('0% of materials');
  const complete = render({ ...state, homeKind: 'largeCabin' });
  expect(complete).toContain('Your shelter journey is complete');
  expect(complete).not.toContain('role="progressbar"');
  expect(complete).not.toContain('<button');
});
