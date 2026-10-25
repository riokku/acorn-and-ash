import { expect, it } from 'vitest';
import { detailedTree } from '../src/scene/tree-detail';
it('distributes detail changes without a player-centered ring', () => {
  const choices = Array.from({ length: 200 }, (_, id) => detailedTree(id, 80));
  const near = choices.filter(Boolean).length;
  expect(near).toBeGreaterThan(50);
  expect(near).toBeLessThan(150);
  for (let id = 0; id < 200; id++) {
    expect(detailedTree(id, 65, false)).toBe(true);
    expect(detailedTree(id, 95, true)).toBe(false);
  }
});
it('keeps a tree stable while taking small steps back and forth around its own boundary', () => {
  for (let id = 0; id < 100; id++) {
    let boundary = 70;
    while (detailedTree(id, boundary)) boundary += 0.1;
    for (const delta of [-1, 0, 1]) {
      expect(detailedTree(id, boundary + delta, true)).toBe(true);
      expect(detailedTree(id, boundary + delta, false)).toBe(false);
    }
  }
});
