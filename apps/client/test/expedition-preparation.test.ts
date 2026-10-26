import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { EXPEDITIONS, calendarAt, emptyExpedition } from '@acorn/shared';
import { expeditionPreparation } from '../src/hud/expedition-preparation';
import { ExpeditionPanel } from '../src/hud/ExpeditionPanel';
import { HudStore, type HudState } from '../src/hud/store';
const initial = () => new HudStore().getSnapshot();
const check = (state: HudState, mission: number, id: string) =>
  expeditionPreparation(state, EXPEDITIONS[mission]!).checks.find((check) => check.id === id);
it('adapts tools to the actual outing and recognizes refined tools', () => {
  const state = initial();
  expect(check(state, 0, 'axe')?.ready).toBe(false);
  expect(check(state, 0, 'rod')).toBeUndefined();
  expect(check({ ...state, carrying: [{ item: 'refinedAxe', count: 1 }] }, 0, 'axe')?.ready).toBe(
    true,
  );
  const fishing = EXPEDITIONS.findIndex((mission) =>
    mission.objectives.some((goal) => goal.kind === 'fish'),
  );
  expect(check(state, fishing, 'rod')?.ready).toBe(false);
  expect(
    check({ ...state, carrying: [{ item: 'refinedRod', count: 1 }] }, fishing, 'rod')?.ready,
  ).toBe(true);
});
it('checks worn protection and weapons without counting a fishing rod as combat preparation', () => {
  const state = {
    ...initial(),
    carrying: [
      { item: 'rod' as const, count: 1 },
      { item: 'winterJacket' as const, count: 1 },
    ],
  };
  expect(check(state, 8, 'weapon')?.ready).toBe(false);
  expect(check(state, 8, 'protection')?.ready).toBe(false);
  const worn = {
    ...state,
    worn: { mainHand: 'ironSword' as const, upperBody: 'winterJacket' as const },
  };
  expect(check(worn, 8, 'weapon')?.ready).toBe(true);
  expect(check(worn, 8, 'protection')?.ready).toBe(true);
});
it('uses real winter and blizzard insulation thresholds, without treating backpack clothing as worn', () => {
  const state = {
    ...initial(),
    season: { ...calendarAt(0, 0), season: 'winter' as const, seasonIndex: 3 },
    carrying: [{ item: 'winterJacket' as const, count: 1 }],
  };
  expect(check(state, 8, 'warmth')?.ready).toBe(false);
  const jacket = { ...state, worn: { upperBody: 'winterJacket' as const } };
  expect(check(jacket, 8, 'warmth')?.ready).toBe(true);
  const blizzard = {
    ...jacket,
    forestWeather: {
      kind: 'blizzard' as const,
      cycle: 0,
      precipitation: 1,
      wind: 1,
      mushroomsAbundant: false,
    },
  };
  expect(check(blizzard, 8, 'warmth')?.ready).toBe(false);
  expect(
    check(
      { ...blizzard, worn: { ...blizzard.worn, helm: 'woolCap', feet: 'leatherBoots' } },
      8,
      'warmth',
    )?.ready,
  ).toBe(true);
  expect(expeditionPreparation(blizzard, EXPEDITIONS[8]!).meal).toBe('berryTea');
});
it('updates packing and optional meals directly from inventory and active benefits', () => {
  const full = {
    ...initial(),
    carrying: (['log', 'stick', 'bone', 'reed', 'stone', 'flower'] as const).map((item) => ({
      item,
      count: 10,
    })),
  };
  expect(check(full, 0, 'space')?.ready).toBe(false);
  const packed = {
    ...full,
    carrying: [
      ...full.carrying,
      { item: 'bag' as const, count: 1 },
      { item: 'forestStew' as const, count: 2 },
    ],
  };
  expect(check(packed, 0, 'food')?.ready).toBe(true);
  expect(check(packed, 0, 'space')?.ready).toBe(true);
  expect(expeditionPreparation(packed, EXPEDITIONS[8]!).specialMeal).toBe(true);
  expect(
    expeditionPreparation(
      { ...initial(), meal: { item: 'forestStew', ticksLeft: 0 } },
      EXPEDITIONS[8]!,
    ).specialMeal,
  ).toBe(false);
});
it('keeps completed reward claims prominent and shows preparation only for an unfinished chosen outing', () => {
  const state = {
    ...initial(),
    nearExpeditionBoard: true,
    expedition: { ...emptyExpedition(), active: 0, offers: [0, 1, 2], notice: 'accepted' as const },
  };
  const active = renderToStaticMarkup(createElement(ExpeditionPanel, { state }));
  expect(active).toContain('Before you take the trail');
  expect(active).toContain('suggestions never prevent you from leaving');
  const done = renderToStaticMarkup(
    createElement(ExpeditionPanel, {
      state: {
        ...state,
        expedition: {
          ...state.expedition,
          progress: EXPEDITIONS[0]!.objectives.map((goal) => goal.goal),
        },
      },
    }),
  );
  expect(done).not.toContain('Before you take the trail');
  expect(done).toContain('Claim rewards');
});
