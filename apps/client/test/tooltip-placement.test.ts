import { describe, expect, it } from 'vitest';
import { TOOLTIP_EDGE_MARGIN, TOOLTIP_GAP, placeTooltip } from '../src/hud/tooltip-placement';

const VIEWPORT = { width: 1280, height: 720 };
const TIP = { width: 200, height: 80 };

function box(left: number, top: number, size = 60) {
  return { left, top, right: left + size, bottom: top + size };
}

describe('where a hover label goes', () => {
  it('sits centred above the thing it is about', () => {
    const placed = placeTooltip(box(600, 400), TIP, VIEWPORT);
    expect(placed.side).toBe('above');
    expect(placed.left).toBe(630 - TIP.width / 2);
    expect(placed.top).toBe(400 - TOOLTIP_GAP - TIP.height);
  });

  it('drops below when there is no room above, like a slot in the top row of the pack', () => {
    const placed = placeTooltip(box(600, 40), TIP, VIEWPORT);
    expect(placed.side).toBe('below');
    expect(placed.top).toBe(100 + TOOLTIP_GAP);
  });

  it('stays inside the window at the left and right edges', () => {
    const left = placeTooltip(box(0, 400), TIP, VIEWPORT);
    expect(left.left).toBe(TOOLTIP_EDGE_MARGIN);
    const right = placeTooltip(box(VIEWPORT.width - 60, 400), TIP, VIEWPORT);
    expect(right.left + TIP.width).toBe(VIEWPORT.width - TOOLTIP_EDGE_MARGIN);
  });

  it('never leaves the window top or bottom, even when it fits neither side', () => {
    const small = { width: 800, height: 400 };
    const tall = { width: 200, height: 300 };
    const placed = placeTooltip(box(300, 170), tall, small);
    expect(placed.top).toBeGreaterThanOrEqual(TOOLTIP_EDGE_MARGIN);
    expect(placed.top + tall.height).toBeLessThanOrEqual(small.height - TOOLTIP_EDGE_MARGIN);
  });

  it('keeps the top left readable when the window is smaller than the label', () => {
    const placed = placeTooltip(
      box(100, 100),
      { width: 500, height: 500 },
      { width: 400, height: 400 },
    );
    expect(placed.left).toBe(TOOLTIP_EDGE_MARGIN);
    expect(placed.top).toBe(TOOLTIP_EDGE_MARGIN);
  });

  it('prefers above when both sides are equally cramped', () => {
    const tall = { width: 200, height: 700 };
    expect(placeTooltip(box(600, 330), tall, VIEWPORT).side).toBe('above');
  });
});
