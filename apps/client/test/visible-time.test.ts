import { describe, expect, it } from 'vitest';
import { VisibleTime } from '../src/hud/visible-time';

describe('homecoming visible-time budget', () => {
  it('does not spend time before first display and resumes after repeated interruptions', () => {
    const budget = new VisibleTime(14000);
    expect(budget.remaining(50000)).toBe(14000);
    expect(budget.start(50000)).toBe(14000);
    budget.pause(53000);
    expect(budget.remaining(90000)).toBe(11000);
    expect(budget.start(90000)).toBe(11000);
    budget.pause(95000);
    expect(budget.start(200000)).toBe(6000);
    expect(budget.remaining(205999)).toBe(1);
    expect(budget.remaining(206000)).toBe(0);
  });
  it('keeps a fresh budget independent of a deferred or expired one', () => {
    const deferred = new VisibleTime(14000);
    deferred.start(100);
    deferred.pause(2100);
    const replacement = new VisibleTime(14000);
    expect(replacement.start(50000)).toBe(14000);
    expect(deferred.remaining(50000)).toBe(12000);
    replacement.pause(64000);
    expect(replacement.remaining(100000)).toBe(0);
  });
});
