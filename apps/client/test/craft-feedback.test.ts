import { expect, it } from 'vitest';
import { CraftFeedback } from '../src/hud/craft-feedback';

it('keeps a slow request pending until its matching result and ignores unrelated results', () => {
  const feedback = new CraftFeedback();
  feedback.begin('rope', 100);
  expect(feedback.text(200)).toContain('Waiting for confirmation');
  expect(feedback.text(8100)).toContain('Still waiting');
  expect(feedback.item).toBe('rope');
  expect(feedback.begin('axe', 8100)).toBe(false);
  expect(feedback.settle('axe')).toBe(false);
  expect(feedback.item).toBe('rope');
  expect(feedback.settle('rope')).toBe(true);
  expect(feedback.text(8200)).toBeNull();
});
it('clears an interrupted request without treating it as success or queuing a retry', () => {
  const feedback = new CraftFeedback();
  feedback.begin('rope', 0);
  expect(feedback.clear()).toBe(true);
  expect(feedback.item).toBeNull();
  expect(feedback.clear()).toBe(false);
});
