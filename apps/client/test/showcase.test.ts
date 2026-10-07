import { describe, expect, it } from 'vitest';

import {
  CLICK_MAX_PIXELS,
  CLICK_MAX_SECONDS,
  FLOURISHES,
  FrameBudget,
  PIXELS_PER_TURN,
  SLOW_STAGE_FRAME_MS,
  STAGE_FRAMES_TO_EASE,
  STAGE_SHARPNESS,
  Showcase,
  VIEW_DEGREES,
  frame,
  isClick,
  normalizeYaw,
  placementOfBox,
  turnedByDrag,
} from '../src/home/showcase';

describe('turning a character by dragging', () => {
  it('turns once all the way round for a drag as wide as the turn', () => {
    const turned = turnedByDrag(0, PIXELS_PER_TURN / 2);
    expect(Math.abs(turned)).toBeCloseTo(Math.PI, 5);
  });

  it('turns towards the right for a drag to the right, and back for one to the left', () => {
    const right = turnedByDrag(0, 56);
    expect(right).toBeGreaterThan(0);
    expect(turnedByDrag(right, -56)).toBeCloseTo(0, 5);
  });

  it('keeps the angle between -PI and PI however far it is dragged', () => {
    let yaw = 0;
    for (let i = 0; i < 40; i++) {
      yaw = turnedByDrag(yaw, 90);
      expect(yaw).toBeGreaterThan(-Math.PI - 1e-9);
      expect(yaw).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
    expect(normalizeYaw(Math.PI * 5)).toBeCloseTo(-Math.PI, 5);
    expect(normalizeYaw(-Math.PI * 4)).toBeCloseTo(0, 5);
  });
});

describe('telling a click from a drag', () => {
  it('counts a short, still press as a click', () => {
    expect(isClick(0, 0.1)).toBe(true);
    expect(isClick(CLICK_MAX_PIXELS, CLICK_MAX_SECONDS)).toBe(true);
  });

  it('does not count a press that moved, or was held, as a click', () => {
    expect(isClick(CLICK_MAX_PIXELS + 1, 0.1)).toBe(false);
    expect(isClick(0, CLICK_MAX_SECONDS + 0.1)).toBe(false);
  });
});

describe('the flourish a click gives', () => {
  it('stands still until clicked', () => {
    const showcase = new Showcase();
    showcase.step(5);
    expect(showcase.playing).toBe(false);
    expect(showcase.view().flourish).toBeNull();
    expect(showcase.view().lift).toBe(0);
    expect(showcase.count).toBe(0);
  });

  it('plays the next flourish each time, and finishes by itself', () => {
    const showcase = new Showcase();
    for (let round = 0; round < FLOURISHES.length * 2; round++) {
      const expected = FLOURISHES[round % FLOURISHES.length];
      expect(showcase.click()).toBe(true);
      expect(showcase.view().flourish).toBe(expected);
      showcase.step((expected?.seconds ?? 0) + 0.01);
      expect(showcase.playing).toBe(false);
    }
    expect(showcase.count).toBe(FLOURISHES.length * 2);
  });

  it('does not start over when clicked again while it is still going', () => {
    const showcase = new Showcase();
    showcase.click();
    showcase.step(0.2);
    expect(showcase.click()).toBe(false);
    expect(showcase.count).toBe(1);
    expect(showcase.view().progress).toBeGreaterThan(0);
  });

  it('lifts a hop off the ground and back down, and keeps the others on it', () => {
    const showcase = new Showcase();
    const hop = FLOURISHES.find((flourish) => flourish.lift > 0);
    expect(hop).toBeDefined();
    showcase.click();
    expect(showcase.view().lift).toBe(0);
    showcase.step((hop?.seconds ?? 1) / 2);
    expect(showcase.view().lift).toBeCloseTo(hop?.lift ?? 0, 5);
    showcase.step((hop?.seconds ?? 1) / 2 + 0.01);
    expect(showcase.view().lift).toBe(0);

    for (const flourish of FLOURISHES) {
      if (flourish.lift === 0) expect(flourish.gesture).not.toBeNull();
    }
  });
});

describe('where the camera stands', () => {
  const placement = { across: 0.5, feet: 0.14, share: 0.62 };

  it('puts the character’s feet and middle where the placement asks', () => {
    const height = 1.1;
    const aspect = 16 / 9;
    const framing = frame(height, aspect, { across: 0.3, feet: 0.2, share: 0.6 });
    const half = Math.tan((VIEW_DEGREES * Math.PI) / 360);
    const visible = framing.distance * 2 * half;
    const width = visible * aspect;
    // The feet, at height 0, sit this share of the way up the screen.
    expect((0 - (framing.lookY - visible / 2)) / visible).toBeCloseTo(0.2, 5);
    // The middle of the world is this share of the way across.
    expect((0 - (framing.x - width / 2)) / width).toBeCloseTo(0.3, 5);
    // And they fill the share asked for.
    expect(height / visible).toBeCloseTo(0.6, 5);
  });

  it('stands further back for a bigger character', () => {
    const small = frame(1, 16 / 9, placement);
    const big = frame(2, 16 / 9, placement);
    expect(big.distance).toBeGreaterThan(small.distance);
  });

  it('backs away on a narrow window so they still fit', () => {
    const wide = frame(1.1, 16 / 9, placement);
    const narrow = frame(1.1, 0.35, placement);
    expect(narrow.distance).toBeGreaterThan(wide.distance);
    const half = Math.tan((VIEW_DEGREES * Math.PI) / 360);
    const width = narrow.distance * 2 * half * 0.35;
    expect(width).toBeGreaterThan(1.1 * 0.7);
  });
});

describe('standing the character in a box on the page', () => {
  it('puts their middle at the box’s middle and their feet on its bottom edge', () => {
    // A 200 px tall box, centred in a 1280 by 800 window.
    const placement = placementOfBox({ left: 540, top: 300, width: 200, height: 200 }, 1280, 800);
    expect(placement?.across).toBeCloseTo(0.5, 5);
    expect(placement?.feet).toBeCloseTo(0.375, 5);
    expect(placement?.share).toBeCloseTo(0.25, 5);
  });

  it('follows the box when the page moves it', () => {
    const lower = placementOfBox({ left: 540, top: 400, width: 200, height: 200 }, 1280, 800);
    expect(lower?.feet).toBeCloseTo(0.25, 5);
  });

  it('gives nothing before the box or the window has a size', () => {
    expect(placementOfBox({ left: 0, top: 0, width: 0, height: 0 }, 1280, 800)).toBeNull();
    expect(placementOfBox({ left: 0, top: 0, width: 10, height: 10 }, 0, 0)).toBeNull();
  });
});

describe('going easy on a slow computer', () => {
  const struggle = (budget: FrameBudget, frames: number): void => {
    for (let i = 0; i < frames; i++) budget.record(SLOW_STAGE_FRAME_MS + 20);
  };

  it('leaves a computer that keeps up alone', () => {
    const budget = new FrameBudget();
    for (let i = 0; i < 1000; i++) budget.record(16);
    expect(budget.sharpness).toBe(1);
    expect(budget.stopped).toBe(false);
  });

  it('forgives a few slow frames among good ones', () => {
    const budget = new FrameBudget();
    for (let round = 0; round < 50; round++) {
      struggle(budget, STAGE_FRAMES_TO_EASE - 1);
      budget.record(10);
    }
    expect(budget.sharpness).toBe(1);
    expect(budget.stopped).toBe(false);
  });

  it('draws less sharp for a computer that keeps struggling, then stops moving', () => {
    const budget = new FrameBudget();
    const changes: boolean[] = [];
    for (let step = 1; step < STAGE_SHARPNESS.length; step++) {
      for (let i = 0; i < STAGE_FRAMES_TO_EASE; i++) {
        changes.push(budget.record(SLOW_STAGE_FRAME_MS + 20));
      }
      expect(budget.sharpness).toBe(STAGE_SHARPNESS[step]);
      expect(budget.stopped).toBe(false);
    }
    expect(changes.filter(Boolean)).toHaveLength(STAGE_SHARPNESS.length - 1);
    struggle(budget, STAGE_FRAMES_TO_EASE);
    expect(budget.stopped).toBe(true);
  });
});
