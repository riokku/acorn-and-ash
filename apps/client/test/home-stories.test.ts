import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { RUMORS, rumorMemoryBit } from '@acorn/shared';
import { HomeStories } from '../src/hud/HomeStories';
it('shows an inviting first goal without claiming an unearned story', () => {
  const html = renderToStaticMarkup(createElement(HomeStories, { cosmetics: 0 }));
  expect(html).toContain('first story remembered here');
  expect(html).not.toContain('data-remembered="true"');
});
it('makes a brought-home story permanent and connects it to the placeable keepsake', () => {
  const html = renderToStaticMarkup(
    createElement(HomeStories, { cosmetics: 1 | rumorMemoryBit(12), onKeepsakes: () => {} }),
  );
  expect(html).toContain(`1 of ${RUMORS.length} woodland stories remembered`);
  expect(html).toContain('data-remembered="true"');
  expect(html).toContain('trail pennant recipe is learned');
  expect(html).toContain('See your earned keepsakes');
});
