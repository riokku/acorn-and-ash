import { describe, expect, it } from 'vitest';

import {
  expeditionBoardClaimsInteract,
  expeditionBoardOpen,
  type BoardClaimState,
} from '../src/hud/board-claim';

const AT_THE_BOARD: BoardClaimState = {
  atExpeditionBoard: true,
  craftMenuOpen: false,
  buildMenuOpen: false,
  inventoryOpen: false,
  mapOpen: false,
  placing: null,
  nearbyItem: null,
  nearbyPile: null,
  nearGatherSpot: null,
  nearBuriedCache: false,
  nearbyDiscovery: null,
  nearCampfire: null,
  boat: null,
};

describe('E reads the expedition board', () => {
  it('claims the press when you stand at the board with nothing else in reach', () => {
    expect(expeditionBoardClaimsInteract(AT_THE_BOARD)).toBe(true);
  });

  it('does nothing away from the board', () => {
    expect(expeditionBoardClaimsInteract({ ...AT_THE_BOARD, atExpeditionBoard: false })).toBe(
      false,
    );
    expect(expeditionBoardClaimsInteract({ ...AT_THE_BOARD, atExpeditionBoard: undefined })).toBe(
      false,
    );
  });

  it.each<[string, Partial<BoardClaimState>]>([
    ['something to pick up', { nearbyItem: 'axe' }],
    ['a dropped pile', { nearbyPile: { item: 'log', count: 2 } }],
    ['a patch to gather', { nearGatherSpot: 'stick' }],
    ['a cache of your own to dig up', { nearBuriedCache: true }],
    ['a find to inspect', { nearbyDiscovery: 'The elk grove' }],
    ['an unlit campfire', { nearCampfire: 'unlit' }],
    ['a lit campfire', { nearCampfire: 'lit' }],
    ['a rowboat to climb into', { boat: 'board' }],
  ])('leaves the press to %s', (_what, reach) => {
    expect(expeditionBoardClaimsInteract({ ...AT_THE_BOARD, ...reach })).toBe(false);
  });

  it('does not mind a boat that cannot be boarded', () => {
    expect(expeditionBoardClaimsInteract({ ...AT_THE_BOARD, boat: 'taken' })).toBe(true);
    expect(expeditionBoardClaimsInteract({ ...AT_THE_BOARD, boat: 'frozen' })).toBe(true);
  });

  it.each<[string, Partial<BoardClaimState>]>([
    ['the craft menu', { craftMenuOpen: true }],
    ['the build menu', { buildMenuOpen: true }],
    ['the pack', { inventoryOpen: true }],
    ['the map', { mapOpen: true }],
    ['a piece in hand', { placing: { name: 'Fence' } }],
  ])('is not for the board while %s is open', (_what, open) => {
    expect(expeditionBoardClaimsInteract({ ...AT_THE_BOARD, ...open })).toBe(false);
  });
});

describe('the board as a page of the field journal', () => {
  it('is open only on its own page of an open journal', () => {
    expect(expeditionBoardOpen({ craftMenuOpen: true, journalTab: 'expeditions' })).toBe(true);
    expect(expeditionBoardOpen({ craftMenuOpen: true, journalTab: 'craft' })).toBe(false);
    expect(expeditionBoardOpen({ craftMenuOpen: false, journalTab: 'expeditions' })).toBe(false);
  });
});
