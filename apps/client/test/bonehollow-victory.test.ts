import { expect, it } from 'vitest';
import { BONEHOLLOW_EXPEDITION_ID, emptyExpedition } from '@acorn/shared';
import { bonehollowVictory } from '../src/hud/bonehollow-victory';
import { CombatFeed } from '../src/hud/combat-feed';

const journey = (progress: number[]) => ({
  ...emptyExpedition(),
  active: BONEHOLLOW_EXPEDITION_ID,
  progress,
});
it('celebrates the captain separately when watch objectives remain', () => {
  expect(bonehollowVictory(journey([1, 2, 0]), journey([1, 2, 1]))?.title).toContain('defeated');
  expect(bonehollowVictory(journey([1, 2, 1]), journey([1, 3, 1]))).toBeNull();
});
it('directs a completed expedition home, regardless of objective order', () => {
  for (const before of [
    [1, 6, 0],
    [1, 5, 1],
  ])
    expect(bonehollowVictory(journey(before), journey([1, 6, 1]))?.detail).toContain('home board');
});
it('does not replay the celebration on initial sync, duplicate updates, claim or a new outing', () => {
  const done = journey([1, 6, 1]);
  expect(bonehollowVictory(emptyExpedition(), done)).toBeNull();
  expect(bonehollowVictory(done, done)).toBeNull();
  expect(bonehollowVictory(done, emptyExpedition())).toBeNull();
  expect(bonehollowVictory(journey([1, 0, 0]), { ...done, cycle: 1 })).toBeNull();
});
it('keeps confirmed hit feedback independent of incoming damage and expires by timestamp', () => {
  const feed = new CombatFeed();
  feed.hurt(0.2, 1, 50);
  feed.confirmStrike(true, 100);
  expect(feed.strikeAtMs).toBe(100);
  expect(feed.strikeDefeated).toBe(true);
  expect(feed.hurtAtMs).toBe(50);
  feed.confirmStrike(false, 500);
  expect(feed.strikeDefeated).toBe(false);
});
