import { HEALTH_MAX, HUNGER_MAX } from '@acorn/shared';
import { describe, expect, it } from 'vitest';

import { curtainMessage, hint } from '../src/hud/Hud';
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
  loadingProgress: 100,
  loadingStage: 'Your forest is ready',
  loadingError: null,
  carrying: [],
  equippedItem: null,
  hotbarSlots: [null, null, null, null, null, null],
  inventoryOpen: false,
  characterOpen: false,
  worn: {},
  selfLook: null,
  gearNotice: null,
  chestSlots: null,
  chestPending: false,
  chestNote: null,
  nearbyItem: null,
  hoveredLoot: null,
  interactionNote: null,
  nearbyPile: null,
  nearGatherSpot: null,
  nearBuriedCache: false,
  ownCacheCompass: null,
  nearCampfire: null,
  nearWorkbench: false,
  nearGarden: false,
  garden: { homeId: 0, yours: false, plots: [], reason: 'unavailable' },
  aimedTree: null,
  aimedAnimal: null,
  aimedRaider: null,
  raidersInSight: 0,
  raidersClose: false,
  raidBanner: null,
  homeSkills: 0,
  homeStoredSupplies: [],
  discoveriesFound: 0,
  discoveriesClaimed: 0,
  discoverySites: [],
  trackHint: null,
  nearbyDiscovery: null,
  journalTab: 'craft',
  craftTab: 'all',
  homeKind: null,
  buildAreaRadius: null,
  canBuild: false,
  buildMenuOpen: false,
  placing: null,
  craftMenuOpen: false,
  canCast: false,
  fishing: null,
  fishingNews: null,
  meal: { item: null, ticksLeft: 0 },
  hunger: HUNGER_MAX,
  hungerNews: null,
  health: HEALTH_MAX,
  healthNews: null,
  charging: false,
  craftingNews: null,
  cookingNews: null,
  huntingNews: null,
  cacheNews: null,
  discardNews: null,
  toasts: [],
  pickupNotice: null,
  canDrop: true,
  isNight: false,
  mapOpen: false,
  door: null,
  home: null,
  resting: null,
  restingNearby: null,
  boat: null,
  signOutSecondsLeft: null,
  signOutNotice: null,
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
    expect(hint(state)).toBe('');
  });

  it('walks you through decorating a room once the panel is open, ahead of everything else', () => {
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
    expect(hint(state)).toBe('Right-click or press E to gather sticks');
  });

  it('names flowers when a flower patch is the one within reach', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'bag', count: 1 }],
      nearGatherSpot: 'flower',
    };
    expect(hint(state)).toBe('Right-click or press E to gather flowers');
  });

  it('calls the reeds that can be cut mature reeds, to tell them from the scenery', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'bag', count: 1 }],
      nearGatherSpot: 'reed',
    };
    expect(hint(state)).toBe('Right-click or press E to gather mature reeds');
  });

  it('offers a patch with no bag at all - six slots come before any bag', () => {
    const state: HudState = { ...BASE_STATE, carrying: [], nearGatherSpot: 'stick' };
    expect(hint(state)).toBe('Right-click or press E to gather sticks');
  });

  it('offers a pickup with no bag at all', () => {
    const state: HudState = { ...BASE_STATE, carrying: [], nearbyItem: 'axe' };
    expect(hint(state)).toBe('Right-click or press E to pick up the axe');
  });

  it('says the pack is full, rather than offering a pickup there is no slot for', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'stick', count: 60 }],
      nearbyItem: 'axe',
    };
    expect(hint(state)).toBe('Your pack is full · no room for the axe');
  });

  it('says the pack is full, rather than offering a patch there is no slot for', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [
        { item: 'log', count: 50 },
        { item: 'flower', count: 10 },
      ],
      nearGatherSpot: 'stick',
    };
    expect(hint(state)).toBe('Your pack is full · no room for more sticks');
  });

  it('still offers a patch in a full pack while its own last stack has room', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [
        { item: 'log', count: 50 },
        { item: 'stick', count: 4 },
      ],
      nearGatherSpot: 'stick',
    };
    expect(hint(state)).toBe('Right-click or press E to gather sticks');
  });

  it('says only one is ever carried, rather than offering a second axe', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'axe', count: 1 }],
      nearbyItem: 'axe',
    };
    expect(hint(state)).toBe('You can only carry one axe');
  });

  it('counts the bag in, so four more slots means room again', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [
        { item: 'stick', count: 60 },
        { item: 'bag', count: 1 },
      ],
      nearbyItem: 'axe',
    };
    expect(hint(state)).toBe('Right-click or press E to pick up the axe');
  });

  it('offers to pick up something dropped, saying how many', () => {
    const state: HudState = { ...BASE_STATE, nearbyPile: { item: 'stick', count: 3 } };
    expect(hint(state)).toBe('Right-click or press E to pick up 3 sticks');
  });

  it('names one dropped thing the same way the toast does', () => {
    const state: HudState = { ...BASE_STATE, nearbyPile: { item: 'flower', count: 1 } };
    expect(hint(state)).toBe('Right-click or press E to pick up 1 flower');
  });

  it('calls a dropped tool "the" tool, since there is only ever one', () => {
    const state: HudState = { ...BASE_STATE, nearbyPile: { item: 'axe', count: 1 } };
    expect(hint(state)).toBe('Right-click or press E to pick up the axe');
  });

  it('reaches for something dropped before a patch, the same order as the server', () => {
    const state: HudState = {
      ...BASE_STATE,
      nearbyPile: { item: 'flower', count: 2 },
      nearGatherSpot: 'stick',
    };
    expect(hint(state)).toBe('Right-click or press E to pick up 2 flowers');
  });

  it('reaches for something lying in the clearing before anything dropped', () => {
    const state: HudState = {
      ...BASE_STATE,
      nearbyItem: 'rod',
      nearbyPile: { item: 'stick', count: 2 },
    };
    expect(hint(state)).toBe('Right-click or press E to pick up the fishing rod');
  });

  it('says the pack is full, rather than offering a pile there is no slot for', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'log', count: 60 }],
      nearbyPile: { item: 'stick', count: 4 },
    };
    expect(hint(state)).toBe('Your pack is full · no room for 4 sticks');
  });

  it('says only one is ever carried, rather than offering a dropped second axe', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'axe', count: 1 }],
      nearbyPile: { item: 'axe', count: 1 },
    };
    expect(hint(state)).toBe('You can only carry one axe');
  });

  it('offers to dig up a buried cache of your own within reach', () => {
    const state: HudState = { ...BASE_STATE, nearBuriedCache: true };
    expect(hint(state)).toBe('Press E to recover belongings · leftovers stay safely here');
  });

  it('reaches for a pickup or a patch before a buried cache, the same button', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'bag', count: 1 }],
      nearBuriedCache: true,
      nearGatherSpot: 'stick',
    };
    expect(hint(state)).toBe('Right-click or press E to gather sticks');
  });

  it('offers to light an unlit campfire within reach', () => {
    const state: HudState = { ...BASE_STATE, nearCampfire: 'unlit' };
    expect(hint(state)).toBe('Press E to light the campfire');
  });

  it('offers to put out a lit campfire within reach', () => {
    const state: HudState = { ...BASE_STATE, nearCampfire: 'lit' };
    expect(hint(state)).toBe('Press E to put out the campfire');
  });

  it('offers to roast raw food held beside a lit campfire', () => {
    const state: HudState = {
      ...BASE_STATE,
      nearCampfire: 'lit',
      carrying: [{ item: 'trout', count: 1 }],
      equippedItem: 'trout',
    };
    expect(hint(state)).toBe('Press E to roast the trout');
  });

  it('still says to cook when hungry, matching what the server will do at the fire', () => {
    const state: HudState = {
      ...BASE_STATE,
      hunger: 0,
      nearCampfire: 'lit',
      carrying: [{ item: 'perch', count: 1 }],
      equippedItem: 'perch',
    };
    expect(hint(state)).toBe('Press E to roast the perch');
  });

  it('does not call already-roasted food cookable', () => {
    const state: HudState = {
      ...BASE_STATE,
      nearCampfire: 'lit',
      carrying: [{ item: 'roastedTrout', count: 1 }],
      equippedItem: 'roastedTrout',
    };
    expect(hint(state)).toBe('Press E to put out the campfire');
  });

  it('warns instead of extinguishing when cooked food would not fit', () => {
    const state: HudState = {
      ...BASE_STATE,
      nearCampfire: 'lit',
      carrying: [
        { item: 'perch', count: 2 },
        { item: 'log', count: 10 },
        { item: 'stick', count: 10 },
        { item: 'flower', count: 10 },
        { item: 'trout', count: 10 },
        { item: 'meat', count: 10 },
      ],
      equippedItem: 'perch',
    };
    expect(hint(state)).toBe('Your pack is full · no room for roasted perch');
  });

  it('reaches for a buried cache of your own before a campfire, the same button', () => {
    const state: HudState = { ...BASE_STATE, nearBuriedCache: true, nearCampfire: 'unlit' };
    expect(hint(state)).toBe('Press E to recover belongings · leftovers stay safely here');
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

  describe('in a fight with skeletons', () => {
    const fighting: HudState = {
      ...BASE_STATE,
      carrying: [{ item: 'axe', count: 1 }],
      equippedItem: 'axe',
      raidersInSight: 2,
      raidersClose: true,
    };

    it('says how many blows the one in front still needs, and how to get out of the way', () => {
      expect(hint({ ...fighting, aimedRaider: { name: 'Skeleton Warrior', hitsLeft: 3 } })).toBe(
        'Left click to fight the skeleton warrior · 3 hits left · Ctrl to roll',
      );
      expect(hint({ ...fighting, aimedRaider: { name: 'Skeleton Rogue', hitsLeft: 1 } })).toBe(
        'Left click to fight the skeleton rogue · 1 hit left · Ctrl to roll',
      );
    });

    it('beats a tree or an animal in reach, the same way the server picks', () => {
      const state: HudState = {
        ...fighting,
        aimedRaider: { name: 'Skeleton Minion', hitsLeft: 4 },
        aimedTree: { name: 'Oak', swingsLeft: 3 },
        aimedAnimal: { name: 'Rabbit' },
      };
      expect(hint(state)).toMatch(/^Left click to fight the skeleton minion/);
    });

    it('says to turn and face one that is close but not in front', () => {
      expect(hint(fighting)).toBe('Face a skeleton and left click to fight · Ctrl to roll');
    });

    it('says to get something in hand first, since a blow needs something to strike with', () => {
      expect(hint({ ...fighting, equippedItem: null })).toBe(
        'Skeletons! Pick something from your hotbar to fight back · Ctrl to roll',
      );
    });

    it('beats being hungry, or something to pick up', () => {
      expect(hint({ ...fighting, hunger: 0, nearbyItem: 'stick' })).toMatch(/skeleton/i);
    });

    it('still gives way to the warning that one more hit and you are down', () => {
      expect(hint({ ...fighting, health: 20 })).toBe('Hurt badly - one more hit and you are down');
    });

    it('still gives way to a menu that was opened on purpose', () => {
      expect(hint({ ...fighting, craftMenuOpen: true })).toBe('Pick one below, or C to close');
    });

    it('says nothing about skeletons once none are close', () => {
      expect(hint({ ...fighting, raidersClose: false })).not.toMatch(/skeleton/i);
    });
  });

  it('says so while a charged attack is winding up, ahead of what you are aimed at', () => {
    const state: HudState = {
      ...BASE_STATE,
      charging: true,
      carrying: [{ item: 'axe', count: 1 }],
      aimedTree: { name: 'Oak', swingsLeft: 3 },
    };
    expect(hint(state)).toBe('Charging a heavy swing · release to strike');
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
    expect(hint({ ...inside, resting: 'bed' })).toBe(
      'Snug in bed · safe and sheltered · move or press E to get up',
    );
  });
});

describe('the hint while sitting on the ground', () => {
  it('says how to get up, outdoors as well as in', () => {
    expect(hint({ ...BASE_STATE, resting: 'ground' })).toBe(
      'Sitting on the ground · move, or press X or E to get up',
    );
  });

  it('lets real danger speak first', () => {
    expect(hint({ ...BASE_STATE, resting: 'ground', health: 10 })).toMatch(/^Hurt badly/);
  });
});

describe('the hint at a rowboat', () => {
  it('offers to climb into a free boat, and says when somebody else has it', () => {
    expect(hint({ ...BASE_STATE, boat: 'board' })).toBe('Press E to climb into the rowboat');
    expect(hint({ ...BASE_STATE, boat: 'taken' })).toBe('Somebody is already rowing this boat');
  });

  it('says a boat is frozen in, in winter', () => {
    expect(hint({ ...BASE_STATE, boat: 'frozen' })).toBe(
      'The rowboat is frozen in the ice · it floats again in spring',
    );
  });

  it('cuts reeds first: a patch beside the boat is what E does', () => {
    const state: HudState = { ...BASE_STATE, boat: 'board', nearGatherSpot: 'reed' };
    expect(hint(state)).not.toBe('Press E to climb into the rowboat');
  });

  it('tells a rower how to row, and whether they can climb out here', () => {
    expect(hint({ ...BASE_STATE, boat: 'climbOut' })).toMatch(/press E to climb out here$/);
    expect(hint({ ...BASE_STATE, boat: 'tooFar' })).toMatch(/row up to a shore to climb out$/);
  });

  it('puts rowing ahead of anything lying around in the reeds', () => {
    const state: HudState = { ...BASE_STATE, boat: 'climbOut', nearGatherSpot: 'reed' };
    expect(hint(state)).toMatch(/climb out here$/);
  });
});

describe('the hint at the expedition board', () => {
  const atBoard: HudState = { ...BASE_STATE, atExpeditionBoard: true };

  it('says E reads the board when you stand at it', () => {
    expect(hint(atBoard)).toBe('Press E to read the expedition board');
  });

  it('keeps to what is already waiting on E: a pickup, a campfire', () => {
    expect(hint({ ...atBoard, nearbyItem: 'axe' })).not.toMatch(/expedition board/);
    expect(hint({ ...atBoard, nearCampfire: 'unlit' })).toBe('Press E to light the campfire');
  });

  it('says nothing about the board away from it', () => {
    expect(hint(BASE_STATE)).not.toMatch(/expedition board/);
  });
});

describe('the paused curtain', () => {
  it('welcomes the player back by name', () => {
    expect(curtainMessage(BASE_STATE)).toBe('Welcome, Acorn. Click to play');
  });

  it('says so when the player is playing in another tab, and how to play here', () => {
    expect(curtainMessage({ ...BASE_STATE, connection: 'elsewhere' })).toBe(
      'You are playing in another tab or window. Click to play here instead',
    );
  });
});
