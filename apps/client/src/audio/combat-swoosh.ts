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

/** Schedule the swishes from the move being drawn and cancel it if that move is interrupted. */
export class CombatSwoosh {
  private seen: SwingFrame | null = null;
  private cancellations: (() => void)[] = [];

  update(move: SwingFrame, volume = 1): void {
    const last = this.seen;
    const fresh =
      last === null ||
      last.kind !== move.kind ||
      last.step !== move.step ||
      move.age < last.age - 1;
    this.seen = { ...move };
    if (!fresh) return;
    this.cancelPending();
    let impact: number,
      strength = 1;
    switch (move.kind) {
      case ActionKind.Swing:
        impact = move.digging
          ? DIG_SWING.impact
          : LIGHT_COMBO[Math.min(Math.max(move.step, 1), LIGHT_COMBO.length) - 1]!.impact;
        break;
      case ActionKind.Strike:
        // A separate swish for each rotation, including when first seen mid-spin.
        for (let turn = 0; turn < STRIKE.turns; turn++) {
          const at =
            STRIKE.spinStart + ((turn + 0.5) / STRIKE.turns) * (STRIKE.spinEnd - STRIKE.spinStart);
          this.schedule(at, move.age, 1.6, volume);
        }
        return;
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
    this.schedule(impact, move.age, strength, volume);
  }

  private schedule(at: number, age: number, strength: number, volume: number): void {
    const remaining = (at - Math.max(0, age)) * TICK_SECONDS;
    // Do not replay a swish first observed after its sweep.
    if (remaining > 0) {
      const cancel = playSwoosh(remaining, strength, volume);
      if (cancel !== null) this.cancellations.push(cancel);
    }
  }

  private cancelPending(): void {
    for (const cancel of this.cancellations) cancel();
    this.cancellations = [];
  }

  clear(): void {
    this.cancelPending();
    this.seen = null;
  }
}
