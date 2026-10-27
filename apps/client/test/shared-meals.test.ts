import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { itemUseHint } from '../src/hud/item-description';
import { Allies } from '../src/hud/Allies';
const ally = {
  netId: 2,
  name: 'Fern',
  self: false,
  health: 100,
  maxHealth: 100,
  downTicks: 0,
  rescueTicks: 0,
  rescuerId: 0,
  inReach: true,
};
it('names the selected companion and the two-serving cost only when the server offers sharing', () => {
  const html = renderToStaticMarkup(
    createElement(Allies, { allies: [{ ...ally, shareMeal: true }], heldMeal: 'forestStew' }),
  );
  expect(html).toContain('Fern');
  expect(html).toContain('Share');
  expect(html).toContain('Forest stew');
  expect(html).toContain('uses 2 servings, one each');
  const unavailable = renderToStaticMarkup(
    createElement(Allies, { allies: [ally], heldMeal: 'forestStew' }),
  );
  expect(unavailable).not.toContain('Share');
});
it('continues to prioritize helping a downed ally', () => {
  const html = renderToStaticMarkup(
    createElement(Allies, { allies: [{ ...ally, downTicks: 200 }], heldMeal: 'forestStew' }),
  );
  expect(html).toContain('help them up');
  expect(html).not.toContain('Share');
});

it('explains sharing on prepared meals while keeping raw fish hold-first instructions', () => {
  expect(itemUseHint('forestStew')).toContain('shares 2 servings');
  expect(itemUseHint('perch')).toContain('Click to hold');
  expect(itemUseHint('perch')).not.toContain('shares');
});

it('keeps the selected supper guest visible even in a large nearby group', () => {
  const crowd = Array.from({ length: 9 }, (_, i) => ({
    ...ally,
    netId: i + 3,
    name: `Companion ${i}`,
  }));
  const html = renderToStaticMarkup(
    createElement(Allies, {
      allies: [...crowd, { ...ally, shareMeal: true }],
      heldMeal: 'forestStew',
    }),
  );
  expect(html).toContain('Fern');
  expect(html).toContain('uses 2 servings');
  expect(html.match(/class="ally"/g)).toHaveLength(8);
});
