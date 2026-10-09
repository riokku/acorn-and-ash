import { expect, it } from 'vitest';
import { WaterWake } from '../src/scene/water-wake';

it('leaves stronger expanding waves while moving, then lets them die away', () => {
  const wake = new WaterWake();
  wake.step(1, 0, -0.3, 0, 2, 0);
  wake.step(1, 0.4, -0.3, 0, 2, 0);
  expect(wake.ripples.filter((r) => r.age === 0)).toHaveLength(1);
  const walking = wake.ripples[0]!.strength;
  wake.step(1, 0.8, -0.3, 0, 5, 0);
  expect(wake.ripples[1]!.strength).toBeGreaterThan(walking);
  wake.update(4);
  expect(wake.ripples.every((r) => r.age >= 3)).toBe(true);
});

it('ignores standing still, jumping, dry ground, ice and teleporting', () => {
  const wake = new WaterWake();
  wake.step(1, 0, -0.3, 0, 0, 0);
  wake.step(1, 0, -0.3, 0, 0, 0);
  wake.step(1, 0.4, 0.8, 0, 2, 0);
  wake.step(1, 0.8, 0, 0, 2, null);
  wake.step(1, 10, -0.3, 0, 2, 0);
  expect(wake.ripples.every((r) => r.age >= 3)).toBe(true);
  wake.clear();
  wake.step(1, 10.4, 0.05, 0, 2, null);
  expect(wake.ripples.every((r) => r.strength === 0)).toBe(true);
});

it('keeps the disturbance pool bounded with multiple players', () => {
  const wake = new WaterWake();
  for (let player = 1; player <= 50; player++) {
    wake.step(player, player, -0.3, 0, 2, 0);
    wake.step(player, player + 0.4, -0.3, 0, 2, 0);
  }
  expect(wake.ripples).toHaveLength(12);
  expect(wake.ripples.every((r) => r.age === 0 && r.strength > 0)).toBe(true);
});
