import { expect, it } from 'vitest';
import { HandSelection, handSelectionText } from '../src/hud/hand-selection';

it('ignores repeated selection taps until that hand change is confirmed', () => {
  const hand = new HandSelection();
  expect(hand.begin('trout', 0)).toBe(true);
  expect(hand.begin('trout', 200)).toBe(false);
  hand.confirm('axe'); // another broadcast is not our confirmation
  expect(hand.begin('trout', 400)).toBe(false);
  hand.confirm('trout');
  expect(hand.begin('trout', 500)).toBe(true);
});
it('allows another choice and recovers from a lost confirmation or reconnect', () => {
  const hand = new HandSelection();
  hand.begin('trout', 0);
  expect(hand.begin('rod', 100)).toBe(true);
  expect(hand.begin('rod', 3100)).toBe(true);
  hand.clear();
  expect(hand.begin('rod', 3200)).toBe(true);
});
it('describes confirmed food selection without narrating login or repeated snapshots', () => {
  expect(handSelectionText(undefined, 'axe')).toBeNull();
  expect(handSelectionText('rod', 'rod')).toBeNull();
  expect(handSelectionText('axe', 'trout')).toContain('select again to eat');
  expect(handSelectionText('axe', 'trout')).toContain('lit fire to cook');
  expect(handSelectionText('rod', 'axe')).toBe('Holding Axe.');
  expect(handSelectionText('axe', null)).toBe('Hands free.');
});
