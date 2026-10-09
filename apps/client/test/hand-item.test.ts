import { describe, expect, it } from 'vitest';

import { handItemFor } from '../src/hud/hand-item';

describe('what the main hand slot shows', () => {
  it('shows a tool chosen from the hotbar, held rather than worn', () => {
    for (const tool of ['axe', 'rod', 'shovel'] as const) {
      expect(handItemFor(tool, {})).toEqual({ item: tool, fromHotbar: true });
    }
  });

  it('shows the worn weapon when nothing is chosen, or when it is the one held', () => {
    expect(handItemFor(null, { mainHand: 'ironSword' })).toEqual({
      item: 'ironSword',
      fromHotbar: false,
    });
    expect(handItemFor('ironSword', { mainHand: 'ironSword' })).toEqual({
      item: 'ironSword',
      fromHotbar: false,
    });
  });

  it('puts a tool ahead of the worn weapon while it is out', () => {
    expect(handItemFor('axe', { mainHand: 'ironSword' })).toEqual({
      item: 'axe',
      fromHotbar: true,
    });
  });

  it('shows nothing for food, a torch or an empty hand', () => {
    expect(handItemFor('roastedPerch', {})).toEqual({ item: null, fromHotbar: false });
    expect(handItemFor('torch', {})).toEqual({ item: null, fromHotbar: false });
    expect(handItemFor(null, {})).toEqual({ item: null, fromHotbar: false });
  });
});
