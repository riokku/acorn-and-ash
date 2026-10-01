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
  playing: true,
  ready: true,
  carrying: [],
  equippedItem: null,
  hotbarSlots: [null, null, null, null, null, null],
  inventoryOpen: false,
  nearbyItem: null,
  nearGatherSpot: null,
  nearBuriedCache: false,
  ownCacheCompass: null,
  nearCampfire: null,
  aimedTree: null,
  aimedAnimal: null,
  canBuild: false,
  buildMenuOpen: false,
  placing: null,
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
  mapOpen: false,
  door: null,
  home: null,
  resting: null,
  restingNearby: null,
};

describe('the hint along the bottom', () => {
  it('offers to chop a tree once the axe is equipped', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'axe', count: 1 }],
      equippedItem: 'axe',
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

  it('does not send you to chop a tree while carrying the axe but not holding it active', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [
        { item: 'axe', count: 1 },
        { item: 'rod', count: 1 },
      ],
      equippedItem: 'rod',
      aimedTree: { name: 'Oak', swingsLeft: 3 },
    };
    // The axe is in the pack, but the rod is the active item, so a swing
    // would do nothing server-side - see `isActiveItem` in world-sim.ts.
    expect(hint(state)).not.toContain('chop');
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
    expect(hint(state)).toBe('Pick one below, or B to close');
  });

  it('says how to place a piece, turn it and put it away while one is out', () => {
    const state: HudState = {
      ...BASE_STATE,
      placing: { name: 'Campfire', refusal: null, canSnap: false },
      aimedTree: { name: 'Oak', swingsLeft: 3 },
      carrying: [{ item: 'axe', count: 1 }],
      equippedItem: 'axe',
    };
    expect(hint(state)).toBe('Click to place the campfire · scroll to turn · Esc to stop');
  });

  it('mentions Shift for a fence, which snaps onto others', () => {
    const state: HudState = {
      ...BASE_STATE,
      placing: { name: 'Fence', refusal: null, canSnap: true },
    };
    expect(hint(state)).toBe(
      'Click to place the fence · scroll to turn · hold Shift to place freely · Esc to stop',
    );
  });

  it('says why a piece will not go where it is pointed', () => {
    const state: HudState = {
      ...BASE_STATE,
      placing: { name: 'Fence', refusal: 'Too close to the oak', canSnap: true },
    };
    expect(hint(state)).toBe('Too close to the oak · Esc to stop');
  });

  it('walks you through the craft menu once it is open, ahead of everything else', () => {
    const state: HudState = {
      ...BASE_STATE,
      craftMenuOpen: true,
      aimedTree: { name: 'Oak', swingsLeft: 3 },
      carrying: [{ item: 'axe', count: 1 }],
    };
    expect(hint(state)).toBe('Pick one below, or C to close');
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
      equippedItem: 'axe',
      aimedAnimal: { name: 'Rabbit' },
    };
    expect(hint(state)).toBe('Left click to catch the rabbit');
  });

  it('offers to fight off a threat, naming how many hits it has left', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'axe', count: 1 }],
      equippedItem: 'axe',
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

describe('the hunger hint', () => {
  it('tells you to press E once the fish you are carrying is the active item', () => {
    const state: HudState = {
      ...BASE_STATE,
      hunger: 0,
      carrying: [{ item: 'perch', count: 2 }],
      equippedItem: 'perch',
    };
    expect(hint(state)).toBe("You're hungry. Press E to eat");
  });

  it('sends you to the hotbar first when the food you are carrying is not active', () => {
    const state: HudState = {
      ...BASE_STATE,
      hunger: 0,
      carrying: [{ item: 'perch', count: 2 }],
      equippedItem: 'axe',
    };
    expect(hint(state)).toBe("You're hungry. Press its hotbar number to eat");
  });

  it('sends you hunting when there is no food at all', () => {
    const state: HudState = { ...BASE_STATE, hunger: 0, carrying: [] };
    expect(hint(state)).toBe("You're hungry. Go catch something to eat");
  });
});

describe('the hint at a door', () => {
  it('invites you into your own home, or to visit an open one', () => {
    expect(hint({ ...BASE_STATE, door: 'enter' })).toBe('Walk in, or press E, to go inside');
    expect(hint({ ...BASE_STATE, door: 'visit' })).toBe('Walk in, or press E, to visit');
  });

  it('says so when somebody else has locked their door', () => {
    expect(hint({ ...BASE_STATE, door: 'locked' })).toBe("The door's locked");
  });

  it('shows the way out, once you are by the door inside', () => {
    expect(hint({ ...BASE_STATE, door: 'leave', home: { yours: true, locked: false } })).toBe(
      'Walk out through the door to leave',
    );
  });

  it('welcomes you home, or says you are visiting, the rest of the time inside', () => {
    expect(hint({ ...BASE_STATE, home: { yours: true, locked: false } })).toMatch(
      /^Home, sweet home/,
    );
    expect(hint({ ...BASE_STATE, home: { yours: false, locked: false } })).toMatch(/^Visiting/);
  });
});

describe('the hint in a fight', () => {
  it('offers a swing at an animal with anything in hand, not just the axe', () => {
    for (const item of ['axe', 'torch', 'rod', 'perch'] as const) {
      const state: HudState = {
        ...BASE_STATE,
        equippedItem: item,
        aimedAnimal: { name: 'Raccoon', hitsLeft: 3 },
      };
      expect(hint(state)).toBe('Left click to fight off the raccoon · 3 hits left');
    }
  });

  it('casts instead, with the rod out facing water', () => {
    const state: HudState = {
      ...BASE_STATE,
      equippedItem: 'rod',
      canCast: true,
      aimedAnimal: { name: 'Rabbit' },
    };
    expect(hint(state)).toBe('Left click to cast');
  });

  it('only chops a tree with the axe, and swings at an animal behind it with anything else', () => {
    const state: HudState = {
      ...BASE_STATE,
      equippedItem: 'torch',
      aimedTree: { name: 'Oak', swingsLeft: 3 },
      aimedAnimal: { name: 'Rabbit' },
    };
    expect(hint(state)).toBe('Left click to catch the rabbit');
  });
});

describe('the hint at the chair and the bed', () => {
  const inside: HudState = { ...BASE_STATE, home: { yours: true, locked: false } };

  it('offers to sit down or lie down', () => {
    expect(hint({ ...inside, restingNearby: 'chair' })).toBe('Press E to sit down');
    expect(hint({ ...inside, restingNearby: 'bed' })).toBe('Press E to lie down');
  });

  it('says E eats first, with food in hand and room for it', () => {
    const state: HudState = {
      ...inside,
      restingNearby: 'chair',
      equippedItem: 'perch',
      carrying: [{ item: 'perch', count: 1 }],
      hunger: HUNGER_MAX - 20,
    };
    expect(hint(state)).toBe('Press E to eat');
    expect(hint({ ...state, hunger: HUNGER_MAX })).toBe('Press E to sit down');
  });

  it('says how to get up again, even when hungry, since E gets you up then', () => {
    expect(hint({ ...inside, resting: 'chair', hunger: 0 })).toMatch(/move or press E to get up$/);
    expect(hint({ ...inside, resting: 'bed' })).toBe('Snug in bed · move or press E to get up');
  });
});
