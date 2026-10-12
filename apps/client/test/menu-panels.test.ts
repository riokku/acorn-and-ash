import { describe, expect, it } from 'vitest';

import { menuPanelState, type MenuPanel } from '../src/input/menu-panels';

const panels: MenuPanel[] = ['pack', 'character', 'map', 'journal', 'decorations'];

describe('central menu transitions', () => {
  it.each(panels)('switching from any panel to %s dismisses the previous screen', (next) => {
    for (const previous of panels) {
      const state = { ...menuPanelState(previous), ...menuPanelState(next) };
      // Character and pack are the one intentional pair (decision 0113).
      expect(
        Number(state.inventoryOpen) +
          Number(state.mapOpen) +
          Number(state.craftMenuOpen) +
          Number(state.buildMenuOpen),
      ).toBe(1);
      expect(state.characterOpen).toBe(next === 'character');
      expect(state.inventoryOpen).toBe(next === 'character' || next === 'pack');
      expect(state.mapOpen).toBe(next === 'map');
    }
  });
  it('opening the pack or journal replaces the full map immediately', () => {
    for (const next of ['pack', 'journal'] as const) {
      const state = { ...menuPanelState('map'), ...menuPanelState(next) };
      expect(state.mapOpen).toBe(false);
      expect(next === 'pack' ? state.inventoryOpen : state.craftMenuOpen).toBe(true);
    }
  });
  it.each(panels)(
    'closing %s clears all central panels, including the shared character screen',
    (panel) => {
      const state = { ...menuPanelState(panel), ...menuPanelState(null) };
      expect(Object.values(state).every((open) => !open)).toBe(true);
    },
  );
});
