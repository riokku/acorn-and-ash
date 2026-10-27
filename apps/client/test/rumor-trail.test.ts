import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { RUMORS, emptyExpedition, type DiscoverySite } from '@acorn/shared';
import { HudStore } from '../src/hud/store';
import { RumorTrail } from '../src/hud/RumorTrail';
import { ExpeditionPanel } from '../src/hud/ExpeditionPanel';
const state = () => ({
  ...new HudStore().getSnapshot(),
  worldSeed: 42,
  expedition: { ...emptyExpedition(), active: 12, offers: [12, 11, 8], notice: 'none' as const },
  discoverySites: [
    { id: 0, kind: 'camp', name: 'Forgotten camp', x: 50, z: 50 },
    { id: 1, kind: 'logging', name: 'Logging site', x: 80, z: 50 },
    { id: 2, kind: 'grove', name: 'Mushroom grove', x: 80, z: 80 },
  ] as DiscoverySite[],
});
it('reveals the next clue from authoritative progress and keeps the find sealed until complete', () => {
  const first = state();
  const render = () => renderToStaticMarkup(createElement(RumorTrail, { state: first }));
  expect(render()).toContain('My pack never made it home');
  expect(render()).not.toContain(RUMORS[0]!.clues[0]);
  first.expedition.progress = [1, 0, 0];
  expect(render()).toContain('Left the pack with the cutters');
  first.expedition.progress = [1, 1, 0];
  expect(render()).toContain('The grove stayed dry');
  first.position = { ...first.position, x: 80, z: 80 };
  expect(render()).toContain('Equip a shovel');
  first.equippedItem = 'shovel';
  expect(render()).toContain('Uncover the hidden bundle');
  first.expedition.progress = [1, 1, 1];
  expect(render()).toContain('Trail complete');
});
it('does not show an outdoor rumor in a home or for an ordinary outing', () => {
  const first = state();
  first.expedition.active = 0;
  expect(renderToStaticMarkup(createElement(RumorTrail, { state: first }))).toBe('');
});
it('offers an honest mystery and reveals exact rewards only after the trail is complete', () => {
  const first = state();
  let html = renderToStaticMarkup(
    createElement(ExpeditionPanel, { state: first, preparation: false }),
  );
  expect(html).toContain('contents are revealed when you finish');
  first.expedition.progress = [1, 1, 1];
  html = renderToStaticMarkup(createElement(ExpeditionPanel, { state: first, preparation: false }));
  expect(html).toContain('rumor-outcome');
  expect(html).toContain('Reward');
});

it('keeps collected notes in the journal without exposing unread clues', () => {
  const first = state();
  first.expedition.progress = [1, 0, 0];
  const html = renderToStaticMarkup(
    createElement(ExpeditionPanel, { state: first, preparation: false }),
  );
  expect(html).toContain('Collected clues');
  expect(html).toContain('Left the pack with the cutters');
  expect(html).not.toContain('The grove stayed dry');
});
