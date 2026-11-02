import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DISCOVERIES } from '@acorn/shared';
import { describe, expect, it } from 'vitest';
import { DiscoveryJournal } from '../src/hud/DiscoveryJournal';
import { ITEM_KINDS } from '../src/item-catalog';
import { HudStore } from '../src/hud/store';

function render(found: number, claimed: number): string {
  return renderToStaticMarkup(
    createElement(DiscoveryJournal, {
      state: {
        ...new HudStore().getSnapshot(),
        discoveriesFound: found,
        discoveriesClaimed: claimed,
      },
    }),
  );
}

describe('discovery illustrations', () => {
  it('shows no colored images for unknown or claimed-only discoveries', () => {
    const all = DISCOVERIES.reduce((mask, discovery) => mask | (1 << discovery.id), 0);
    expect(render(0, 0)).not.toContain('<img');
    expect(render(0, all)).not.toContain('<img');
  });
  for (const discovery of DISCOVERIES) {
    it(`reveals only ${discovery.kind} when its found bit is set`, () => {
      const bit = 1 << discovery.id;
      const unclaimed = render(bit, 0);
      const claimed = render(bit, bit);
      for (const html of [unclaimed, claimed]) {
        const images = html.match(/<img\b[^>]*>/g) ?? [];
        expect(images).toHaveLength(1);
        expect(images[0]).toContain(`data-discovery-kind="${discovery.kind}"`);
        expect(images[0]).toContain(`${discovery.kind}.webp`);
      }
      expect(unclaimed).toContain('Marked on your map · inspect with E for your reward');
      const claimedEntry = claimed
        .match(/<article\b[^>]*>.*?<\/article>/g)!
        .find((entry) => entry.includes(`data-discovery-kind="${discovery.kind}"`))!;
      expect(claimedEntry).not.toContain('Marked on your map');
      const status =
        discovery.kind === 'elkGrove'
          ? 'Sketch recorded'
          : discovery.kind === 'guardianHollow'
            ? 'Trophy collected'
            : discovery.recipe === null
              ? 'Supplies collected'
              : `Learned: ${ITEM_KINDS[discovery.recipe].displayName}`;
      expect(claimedEntry).toContain(status);
      expect(claimedEntry).toContain(discovery.note);
    });
  }
});
