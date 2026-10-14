import { afterEach, expect, it, vi } from 'vitest';
import { ActionKind, DIG_SWING, LIGHT_COMBO, TICK_SECONDS } from '@acorn/shared';
const sound = vi.hoisted(() => ({ play: vi.fn(), cancel: vi.fn() }));
vi.mock('../src/audio/sound', () => ({ playSwoosh: sound.play }));
import { CombatSwoosh } from '../src/audio/combat-swoosh';
afterEach(() => vi.clearAllMocks());

it('times a partly observed swing to the remaining impact and cancels an interruption', () => {
  sound.play.mockReturnValue(sound.cancel);
  const swish = new CombatSwoosh();
  swish.update({ kind: ActionKind.Swing, step: 1, age: LIGHT_COMBO[0].impact - 1 });
  expect(sound.play).toHaveBeenCalledWith(TICK_SECONDS, 1, 1);
  swish.update({ kind: ActionKind.Swing, step: 1, age: LIGHT_COMBO[0].impact - 0.5 });
  expect(sound.play).toHaveBeenCalledTimes(1);
  swish.update({ kind: ActionKind.Flinch, step: 0, age: 0 });
  expect(sound.cancel).toHaveBeenCalledTimes(1);
  swish.clear();
  expect(sound.cancel).toHaveBeenCalledTimes(1);
});

it('keeps combo steps, repeated moves and shovel timing distinct without replaying late hits', () => {
  sound.play.mockReturnValue(sound.cancel);
  const swish = new CombatSwoosh();
  swish.update({ kind: ActionKind.Swing, step: 1, age: 0, digging: true });
  expect(sound.play).toHaveBeenLastCalledWith(DIG_SWING.impact * TICK_SECONDS, 1, 1);
  swish.update({ kind: ActionKind.Swing, step: 1, age: 3, digging: true });
  swish.update({ kind: ActionKind.Swing, step: 1, age: 2.5, digging: true });
  expect(sound.play).toHaveBeenCalledTimes(1);
  swish.update({ kind: ActionKind.Swing, step: 1, age: 0, digging: true });
  expect(sound.play).toHaveBeenCalledTimes(2);
  swish.update({ kind: ActionKind.Swing, step: 2, age: LIGHT_COMBO[1].impact + 1 });
  expect(sound.play).toHaveBeenCalledTimes(2);
  expect(sound.cancel).toHaveBeenCalledTimes(2);
});

it('covers airborne follow-ups and releases a pending move on removal', () => {
  sound.play.mockReturnValue(sound.cancel);
  const swish = new CombatSwoosh();
  swish.update({ kind: ActionKind.DodgeLight, step: 0, age: 0 }, 0.4);
  expect(sound.play.mock.lastCall![2]).toBe(0.4);
  swish.update({ kind: ActionKind.DodgeHeavy, step: 0, age: 0 });
  expect(sound.cancel).toHaveBeenCalledTimes(1);
  swish.clear();
  expect(sound.cancel).toHaveBeenCalledTimes(2);
});
