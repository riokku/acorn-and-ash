import { HUNGER_MAX } from '@acorn/shared';
import { describe, expect, it } from 'vitest';

import { hint } from '../src/hud/Hud';
import type { HudState } from '../src/hud/store';

const BASE_STATE: HudState = {
  connection: 'connected',
  connectionDetail: '',
  backend: 'WebGPU',
  forcedFallback: false,
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
  nearGatherSpot: false,
  aimedTree: null,
  aimedAnimal: null,
  canBuild: false,
  canCast: false,
  fishing: null,
  fishingNews: null,
  hunger: HUNGER_MAX,
  hungerNews: null,
  craftingNews: null,
  huntingNews: null,
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

  it('still offers to build a campfire when unarmed and nothing else is going on', () => {
    const state: HudState = {
      ...BASE_STATE,
      carrying: [],
      aimedTree: { name: 'Oak', swingsLeft: 3 },
      canBuild: true,
    };
    expect(hint(state)).toBe('Press B to build a campfire');
  });
});
