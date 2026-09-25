import { describe, expect, it } from 'vitest';

import { pickAnimationState } from '../src/scene/character-animation';

describe('picking which animation clip fits the moment', () => {
  it('shows idle when standing still on the ground', () => {
    expect(pickAnimationState(false, false, false)).toBe('idle');
  });

  it('shows walk once moving at an ordinary pace', () => {
    expect(pickAnimationState(true, false, false)).toBe('walk');
  });

  it('shows run once moving fast enough to count as a sprint', () => {
    expect(pickAnimationState(true, true, false)).toBe('run');
  });

  it('shows jump whenever airborne, even rising straight up with no horizontal speed', () => {
    expect(pickAnimationState(false, false, true)).toBe('jump');
  });

  it('lets airborne win over sprinting - you cannot run in mid-air', () => {
    expect(pickAnimationState(true, true, true)).toBe('jump');
  });
});
