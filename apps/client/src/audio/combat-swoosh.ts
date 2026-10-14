import {
  ActionKind,
  DIG_SWING,
  DODGE_ATTACKS,
  LIGHT_COMBO,
  STRIKE,
  TICK_SECONDS,
} from '@acorn/shared';
import { playSwoosh } from './sound';

interface SwingFrame {
  readonly kind: ActionKind;
  readonly step: number;
  readonly age: number;
  readonly digging?: boolean;
}

/** Schedule one swish from the move being drawn and cancel it if that move is interrupted. */
export class CombatSwoosh {
  private seen: SwingFrame | null = null;
  private cancel: (() => void) | null = null;

  update(move: SwingFrame, volume = 1): void {
    const last = this.seen;
    const fresh =
      last === null ||
      last.kind !== move.kind ||
      last.step !== move.step ||
      move.age < last.age - 1;
    this.seen = { ...move };
    if (!fresh) return;
    this.cancel?.();
    this.cancel = null;
    let impact: number,
      strength = 1;
    switch (move.kind) {
      case ActionKind.Swing:
        impact = move.digging
          ? DIG_SWING.impact
          : LIGHT_COMBO[Math.min(Math.max(move.step, 1), LIGHT_COMBO.length) - 1]!.impact;
        break;
      case ActionKind.Strike:
        impact = STRIKE.impact;
        strength = 1.6;
        break;
      case ActionKind.DodgeLight:
        impact = DODGE_ATTACKS.light.impact;
        strength = 1.3;
        break;
      case ActionKind.DodgeHeavy:
        impact = DODGE_ATTACKS.heavy.impact;
        strength = 1.6 * 1.3;
        break;
      default:
        return;
    }
    const remaining = (impact - Math.max(0, move.age)) * TICK_SECONDS;
    // Do not replay a blow first observed after its impact.
    if (remaining > 0) this.cancel = playSwoosh(remaining, strength, volume);
  }

  clear(): void {
    this.cancel?.();
    this.cancel = null;
    this.seen = null;
  }
}
