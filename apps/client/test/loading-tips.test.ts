import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LoadingScreen } from '../src/hud/LoadingScreen';
import { HudStore, type HudState } from '../src/hud/store';

function render(changes: Partial<HudState> = {}): string {
  return renderToStaticMarkup(
    createElement(LoadingScreen, {
      state: {
        ...new HudStore().getSnapshot(),
        loadingProgress: 42,
        loadingStage: 'Preparing your journey',
        ...changes,
      },
    }),
  );
}

describe('loading screen tips', () => {
  it('shows an optional first tip while preserving progress and status', () => {
    const html = render();
    expect(html).toContain('aria-label="Trail tip"');
    expect(html).toContain('1 of 4');
    expect(html).toContain('Equip an axe from your hotbar before chopping trees.');
    expect(html).toContain('Next tip');
    expect(html).toContain('aria-valuenow="42"');
    expect(html).toContain('aria-valuetext="42% · Preparing your journey"');
    expect(html).toContain('role="status">Preparing your journey');
    expect(html).not.toContain('Try again');
  });
  it('preserves the error alert, clamped progress and retry without a tip', () => {
    const html = render({ loadingError: 'Failed to prepare', loadingProgress: 120 });
    expect(html).not.toContain('aria-label="Trail tip"');
    expect(html).toContain('aria-valuenow="100"');
    expect(html).toContain('aria-valuetext="100% · Failed to prepare"');
    expect(html).toContain('role="alert">Failed to prepare');
    expect(html).toContain('Try again');
  });
  it.each([
    ['rejected', 'This world is full. Try again in a moment.', true],
    ['offline', 'Cannot reach the world server. Retrying…', false],
    ['elsewhere', 'You are playing in another tab or window.', false],
    ['deleted', 'This character was deleted. Starting over…', false],
  ] as const)('keeps %s guidance and retry behavior without a tip', (connection, detail, retry) => {
    const html = render({ connection, connectionDetail: '', loadingProgress: -1 });
    expect(html).not.toContain('aria-label="Trail tip"');
    expect(html).toContain('aria-valuenow="0"');
    expect(html).toContain(`role="status">${detail}`);
    expect(html.includes('Try again</button>')).toBe(retry);
  });
});
