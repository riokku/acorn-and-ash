import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { KEEPSAKES } from '../src/hud/keepsakes';
import { TrophyCollection } from '../src/hud/TrophyCollection';
import { HudStore } from '../src/hud/store';
import { CraftPanel } from '../src/hud/Hud';

it('keeps earned display recipes locked until their actual requirements are met', () => {
  const state = {
    ...new HudStore().getSnapshot(),
    homeKind: 'tent' as const,
    carrying: [
      { item: 'guardianTrophy' as const, count: 1 },
      { item: 'log' as const, count: 3 },
      { item: 'flower' as const, count: 3 },
    ],
  };
  const html = renderToStaticMarkup(createElement(TrophyCollection, { state }));
  expect(html).toContain('0/8 kinds on display');
  const fish = html.split('data-keepsake="fishDisplay"')[1]!.split('</article>')[0]!;
  expect(fish).toContain('disabled');
  expect(fish).toContain('Catch five fish');
  const guardian = html.split('data-keepsake="guardianTrophy"')[1]!.split('</article>')[0]!;
  expect(guardian).not.toContain('disabled');
  expect(guardian).toContain('Choose a place in your yard');
  expect(html).toContain('Contribute to defeating the Hollow King');
});
it('counts placed kinds once and does not mistake carried items for displayed trophies', () => {
  const state = {
    ...new HudStore().getSnapshot(),
    homeKind: 'tent' as const,
    trophyDisplays: [
      'guardianTrophy' as const,
      'guardianTrophy' as const,
      'firstBellRelic' as const,
    ],
    carrying: [{ item: 'lastBellTrophy' as const, count: 1 }],
  };
  const html = renderToStaticMarkup(createElement(TrophyCollection, { state }));
  expect(html).toContain('2/8 kinds on display');
  expect(html).toContain('data-keepsake="firstBellRelic" data-displayed="true"');
  expect(html).toContain('data-keepsake="lastBellTrophy" data-displayed="false"');
  const noHome = renderToStaticMarkup(
    createElement(TrophyCollection, { state: { ...state, homeKind: null } }),
  );
  expect(noHome).toContain('Build a home first');
});
it('offers one placement action per earned keepsake without replacing the normal All page', () => {
  const state = {
    ...new HudStore().getSnapshot(),
    homeKind: 'tent' as const,
    craftTab: 'trophies' as const,
  };
  const html = renderToStaticMarkup(createElement(CraftPanel, { state, navigation: null }));
  for (const { kind } of KEEPSAKES)
    expect(html.match(new RegExp(`data-keepsake="${kind}"`, 'g'))).toHaveLength(1);
  const all = renderToStaticMarkup(
    createElement(CraftPanel, { state: { ...state, craftTab: 'all' }, navigation: null }),
  );
  expect(all).toContain('Campfire');
  expect(all).toContain('Guardian trophy');
  expect(html).toContain('Stories brought home');
});
