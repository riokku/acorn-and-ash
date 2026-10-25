import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { startMeal } from '@acorn/shared';
import { HudStore } from '../src/hud/store';
import { CraftPanel } from '../src/hud/Hud';
import { FirePanel } from '../src/hud/FirePanel';
import { craftMenuEntries } from '../src/hud/craft-menu';

function state() {
  const store = new HudStore();
  store.publish({
    craftTab: 'food',
    connection: 'connected',
    nearCampfire: 'lit',
    discoveriesClaimed: (1 << 0) | (1 << 2) | (1 << 3),
    carrying: [
      { item: 'roastedMeat', count: 2 },
      { item: 'berry', count: 5 },
      { item: 'mushroom', count: 1 },
      { item: 'trailRation', count: 2 },
    ],
    meal: startMeal('forestStew'),
  });
  return store.getSnapshot();
}
it('connects meal roles to ingredients, packed stock and the active bonus without auto-eating', () => {
  const html = renderToStaticMarkup(
    createElement(CraftPanel, { state: state(), navigation: null }),
  );
  expect(html).toContain('Hunting &amp; nimble escapes');
  expect(html).toContain('Winter walks &amp; foraging');
  expect(html).toContain('Long fights &amp; recovery');
  expect(html).toContain('2 packed');
  expect(html).toContain('5/3');
  expect(html).toContain('1/3');
  expect(html).toContain('Preparing packs a meal');
  expect(html).toContain('preparing one does not');
  expect(html).toContain('+10 warmth');
  expect(html).toContain('Prepare 1');
});
it('names where to learn locked meal recipes and keeps fire requirements meaningful', () => {
  const baseline = { ...state(), discoveriesClaimed: 0, nearCampfire: null };
  const entries = craftMenuEntries(baseline);
  expect(
    entries.find((e) => e.action.kind === 'craft' && e.action.item === 'berryTea')?.supplyNote,
  ).toContain('mossy shrine');
  const noFire = craftMenuEntries({ ...state(), nearCampfire: null });
  expect(
    noFire.find((e) => e.action.kind === 'craft' && e.action.item === 'berryTea')?.status,
  ).toBe('needFire');
  expect(
    noFire.find((e) => e.action.kind === 'craft' && e.action.item === 'trailRation')?.ready,
  ).toBe(true);
});
it('offers meal preparation from the fire panel, not from log storage', () => {
  const fire = {
    propId: 1,
    mode: 'fire' as const,
    lit: true,
    remainingMs: 600000,
    storedLogs: 0,
    capacity: 20,
    yours: true,
    x: 0,
    y: 0,
  };
  const html = renderToStaticMarkup(
    createElement(FirePanel, { fire, state: state(), onOpenMeals: () => {} }),
  );
  expect(html).toContain('Prepare meals');
  const storage = renderToStaticMarkup(
    createElement(FirePanel, {
      fire: { ...fire, mode: 'storage' },
      state: state(),
      onOpenMeals: () => {},
    }),
  );
  expect(storage).not.toContain('Prepare meals');
});
