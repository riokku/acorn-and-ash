import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { PickupNotice } from '../src/hud/PickupNotice';
import { PickupNoticeShelf } from '../src/hud/pickup-notice';

describe('pickup refusal feedback', () => {
  it('refreshes one notice without stacking sounds on rapid retries, then expires', () => {
    const shelf = new PickupNoticeShelf();
    expect(shelf.show('log', 'full', 0)).toBe(true);
    expect(shelf.show('log', 'full', 100)).toBe(false);
    expect(shelf.current(100)?.item).toBe('log');
    expect(shelf.show('flower', 'full', 1000)).toBe(true);
    expect(shelf.current(4399)?.item).toBe('flower');
    expect(shelf.current(4400)).toBeNull();
  });

  it('announces the failure accessibly and offers a pack shortcut', () => {
    const html = renderToStaticMarkup(
      createElement(PickupNotice, {
        notice: { id: 1, item: 'log', reason: 'full' },
        onOpenPack: () => {},
      }),
    );
    expect(html).toContain('Inventory full');
    expect(html).toContain('Left on the ground');
    expect(html).toContain('Open pack');
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-atomic="true"');
  });

  it('does not call a duplicate tool a full inventory', () => {
    const html = renderToStaticMarkup(
      createElement(PickupNotice, {
        notice: { id: 2, item: 'axe', reason: 'limit' },
        onOpenPack: () => {},
      }),
    );
    expect(html).toContain('Already carrying one');
    expect(html).not.toContain('Inventory full');
  });
});
