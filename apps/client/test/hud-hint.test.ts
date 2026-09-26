import { HEALTH_MAX, HUNGER_MAX } from '@acorn/shared';
import { describe, expect, it } from 'vitest';

import { hint } from '../src/hud/Hud';
import type { HudState } from '../src/hud/store';

const BASE_STATE: HudState = {
  connection: 'connected',
  connectionDetail: '',
  backend: 'WebGPU',
  forcedFallback: false,
  playerName: 'Acorn',
  fps: 60,
  pingMs: 50,
  playersOnline: 1,
  serverTick: 0,
  position: { x: 0, y: 0, z: 0 },
  correctionCm: 0,
  pointerLocked: true,
  ready: true,
  carrying: [],
  nearbyItem: null,
  nearGatherSpot: null,
  nearBuriedCache: false,
  nearCampfire: null,
  aimedTree: null,
  aimedAnimal: null,
  canBuild: false,
  buildMenuOpen: false,
  craftMenuOpen: false,
  canCast: false,
  fishing: null,
  fishingNews: null,
  hunger: HUNGER_MAX,
  hungerNews: null,
  health: HEALTH_MAX,
  healthNews: null,
  charging: false,
  craftingNews: null,
  huntingNews: null,
  cacheNews: null,
  isNight: false,
};

describe('the hint along the bottom', () => {
  it('offers to chop a tree once there is an axe in hand', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'axe', count: 1 }],
      aimedTree: { name: 'Oak', swingsLeft: 3 },
    };
    expect(hint(state)).toBe('Left click to chop the oak · 3 swings left');
  });

  it('does not send you to swing at a tree before you have found the axe', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [],
      aimedTree: { name: 'Oak', swingsLeft: 3 },
    };
    // A swing with no axe is ignored server-side, so this must not tell you to
    // click - it falls through to whatever else is worth doing (here, nothing).
    expect(hint(state)).not.toContain('chop');
  });

  it('does not send you to catch an animal before you have found the axe', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [],
      aimedAnimal: { name: 'Rabbit' },
    };
    expect(hint(state)).not.toContain('catch');
  });

  it('offers to build once something is affordable and fits, without naming which', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [],
      aimedTree: { name: 'Oak', swingsLeft: 3 },
      canBuild: true,
    };
    // Two buildable kinds exist now, so the hint no longer picks one by name -
    // the menu is where that choice happens.
    expect(hint(state)).toBe('Press B to build');
  });

  it('walks you through the build menu once it is open, ahead of everything else', () => {
    const state: HudState = {
      ...BASE_STATE,
      buildMenuOpen: true,
      aimedTree: { name: 'Oak', swingsLeft: 3 },
      carrying: [{ item: 'axe', count: 1 }],
    };
    expect(hint(state)).toBe(
      'Press 1 for a campfire, 2 for a cabin, 3 for a flower bed, 4 for a lantern - or B to cancel',
    );
  });

  it('walks you through the craft menu once it is open, ahead of everything else', () => {
    const state: HudState = {
      ...BASE_STATE,
      craftMenuOpen: true,
      aimedTree: { name: 'Oak', swingsLeft: 3 },
      carrying: [{ item: 'axe', count: 1 }],
    };
    // "an axe", not "a axe" - the recipe list has to get the grammar right too.
    expect(hint(state)).toBe('Press 1 for an axe, 2 for a fishing rod - or C to cancel');
  });

  it('names sticks when a stick patch is the one within reach', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'bag', count: 1 }],
      nearGatherSpot: 'stick',
    };
    expect(hint(state)).toBe('Press E to gather sticks');
  });

  it('names flowers when a flower patch is the one within reach', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'bag', count: 1 }],
      nearGatherSpot: 'flower',
    };
    expect(hint(state)).toBe('Press E to gather flowers');
  });

  it('sends you to find a bag first, before naming what a patch would give', () => {
    const state: HudState = { ...BASE_STATE, carrying: [], nearGatherSpot: 'stick' };
    expect(hint(state)).toBe("You'll need something to carry things in first");
  });

  it('sends you to find a bag first, before naming a pickup within reach', () => {
    const state: HudState = { ...BASE_STATE, carrying: [], nearbyItem: 'axe' };
    expect(hint(state)).toBe("You'll need something to carry things in first");
  });

  it('offers to dig up a buried cache of your own within reach', () => {
    const state: HudState = { ...BASE_STATE, nearBuriedCache: true };
    expect(hint(state)).toBe('Press E to dig up your buried stash');
  });

  it('reaches for a pickup or a patch before a buried cache, the same button', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'bag', count: 1 }],
      nearBuriedCache: true,
      nearGatherSpot: 'stick',
    };
    expect(hint(state)).toBe('Press E to gather sticks');
  });

  it('offers to light an unlit campfire within reach', () => {
    const state: HudState = { ...BASE_STATE, nearCampfire: 'unlit' };
    expect(hint(state)).toBe('Press E to light the campfire');
  });

  it('offers to put out a lit campfire within reach', () => {
    const state: HudState = { ...BASE_STATE, nearCampfire: 'lit' };
    expect(hint(state)).toBe('Press E to put out the campfire');
  });

  it('reaches for a buried cache of your own before a campfire, the same button', () => {
    const state: HudState = { ...BASE_STATE, nearBuriedCache: true, nearCampfire: 'unlit' };
    expect(hint(state)).toBe('Press E to dig up your buried stash');
  });

  it('offers to catch prey with no mention of hits, since one swing is always enough', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'axe', count: 1 }],
      aimedAnimal: { name: 'Rabbit' },
    };
    expect(hint(state)).toBe('Left click to catch the rabbit');
  });

  it('offers to fight off a threat, naming how many hits it has left', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'axe', count: 1 }],
      aimedAnimal: { name: 'Masked raccoon', hitsLeft: 2 },
    };
    expect(hint(state)).toBe('Left click to fight off the masked raccoon · 2 hits left');
  });

  it('warns plainly once health is low, ahead of everything but an actual bite', () => {
    const state: HudState = {
      ...BASE_STATE,
      health: 20,
      aimedTree: { name: 'Oak', swingsLeft: 3 },
      carrying: [{ item: 'axe', count: 1 }],
    };
    expect(hint(state)).toBe('Hurt badly - one more hit and you are down');
  });

  it('says so while a charged attack is winding up, ahead of what you are aimed at', () => {
    const state: HudState = {
      ...BASE_STATE,
      charging: true,
      carrying: [{ item: 'axe', count: 1 }],
      aimedTree: { name: 'Oak', swingsLeft: 3 },
    };
    expect(hint(state)).toBe('Charging a heavy swing - rooted to the spot');
  });
});
