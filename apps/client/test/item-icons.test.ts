import { BUILDABLE_KIND_ORDER, ITEM_ORDER } from '@acorn/shared';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { BuildableIcon, ItemIcon } from '../src/hud/item-icons';
import { PAINTED_ICONS } from '../src/hud/painted-icons';

describe('inventory artwork', () => {
  it('provides painted artwork for every canonical item and buildable', () => {
    for (const item of ITEM_ORDER) {
      expect(renderToStaticMarkup(ItemIcon({ item, color: '#abcdef' })), item).toContain('<image');
    }
    for (const kind of BUILDABLE_KIND_ORDER) {
      expect(renderToStaticMarkup(BuildableIcon({ kind, color: '#abcdef' })), kind).toContain(
        '<image',
      );
    }
  });
  it('centers artwork at a useful size without distorting it, while keeping the decorative SVG', () => {
    const first = renderToStaticMarkup(
      ItemIcon({ item: 'axe', color: '#123456', className: 'slot-icon' }),
    );
    const last = renderToStaticMarkup(ItemIcon({ item: 'forestStew', color: '#123456' }));

    expect(first).toContain('class="slot-icon"');
    expect(first).toContain('aria-hidden="true"');
    expect(first).toContain('viewBox="0 0 24 24"');
    expect(first).toContain('overflow:hidden');
    // Independently measured alpha bounds for two differently shaped icons.
    for (const [markup, bounds] of [
      [first, [82, 121, 200, 182]],
      [last, [991, 984, 183, 153]],
    ] as const) {
      const image = markup.match(
        /<image[^>]* x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/,
      );
      expect(image).not.toBeNull();
      const x = Number(image![1]);
      const y = Number(image![2]);
      const width = Number(image![3]);
      const height = Number(image![4]);
      const scale = width / 1254;
      expect(height).toBeCloseTo(width);
      expect(x + (bounds[0] + bounds[2] / 2) * scale).toBeCloseTo(12);
      expect(y + (bounds[1] + bounds[3] / 2) * scale).toBeCloseTo(12);
      expect(Math.max(bounds[2], bounds[3]) * scale).toBeCloseTo(24 * 0.82);
    }
  });

  it('keeps a colored silhouette when artwork is unavailable', () => {
    const saved = PAINTED_ICONS.refinedAxe;
    delete PAINTED_ICONS.refinedAxe;
    try {
      const icon = renderToStaticMarkup(ItemIcon({ item: 'refinedAxe', color: '#abcdef' }));
      expect(icon).toContain('fill="#abcdef"');
      expect(icon).toContain('aria-hidden="true"');
      expect(icon).not.toContain('<image');
      expect(icon).toMatch(/<(path|g|rect|circle|polygon|ellipse)\b/);
    } finally {
      PAINTED_ICONS.refinedAxe = saved;
    }
  });

  it('uses a separate clip for each painted icon on the page', () => {
    const markup = renderToStaticMarkup(
      createElement(
        'div',
        null,
        createElement(ItemIcon, { item: 'axe', color: '#123456' }),
        createElement(BuildableIcon, { kind: 'guardianTrophy', color: '#123456' }),
      ),
    );
    const ids = [...markup.matchAll(/<clipPath id="([^"]+)"/g)].map((match) => match[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(markup).toContain(`clip-path="url(#${id})"`);
  });
});
