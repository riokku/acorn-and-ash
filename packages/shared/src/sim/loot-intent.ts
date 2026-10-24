import { ActionKind, type ActionState } from './actions';
import { DIG_SWING, DODGE, DODGE_ATTACKS, FLINCH, LIGHT_COMBO, STRIKE } from '../data/moves';
import { TICK_HZ } from '../constants';
export const LOOT_INTENT_TICKS = Math.round(TICK_HZ / 4);
/** Only the tail of a finite action can accept a pickup click in advance. */
export function canBufferLoot(
  action: Pick<ActionState, 'kind' | 'step' | 'age'>,
  digging = false,
): boolean {
  const end =
    action.kind === ActionKind.Idle
      ? 0
      : action.kind === ActionKind.Swing
        ? digging
          ? DIG_SWING.end
          : LIGHT_COMBO[Math.max(0, action.step - 1)]?.end
        : action.kind === ActionKind.Flinch
          ? FLINCH.end
          : action.kind === ActionKind.Dodge
            ? DODGE.end
            : action.kind === ActionKind.Strike
              ? STRIKE.end
              : action.kind === ActionKind.DodgeLight
                ? DODGE_ATTACKS.light.end
                : action.kind === ActionKind.DodgeHeavy
                  ? DODGE_ATTACKS.heavy.end
                  : undefined;
  return end !== undefined && end - action.age <= LOOT_INTENT_TICKS;
}
