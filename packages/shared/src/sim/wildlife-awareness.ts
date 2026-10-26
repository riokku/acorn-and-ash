import type { AnimalKind } from '../data/animals';
import { SPRINT_REPORTING_SPEED } from '../constants';

/** Actual movement, not a held sprint button: pushing against a rock stays quiet. */
export function wildlifeNoticeRadius(kind: Pick<AnimalKind, 'alertRadius'>, speed: number): number {
  return kind.alertRadius * (speed > SPRINT_REPORTING_SPEED ? 1.25 : speed > 0.15 ? 0.72 : 0.48);
}

export interface WildlifeAwareness {
  readonly awareness: number;
  readonly attentive: boolean;
  readonly fleeing: boolean;
}

/** Prey watches an uncertain approach before bolting; a close surprise is immediate. */
export function stepWildlifeAwareness(
  awareness: number,
  fleeing: boolean,
  distance: number,
  speed: number,
  kind: Pick<AnimalKind, 'alertRadius' | 'safeRadius' | 'awarenessTimeScale'>,
  seconds: number,
): WildlifeAwareness {
  if (fleeing) {
    const stillFleeing = distance < kind.safeRadius;
    return { awareness: 0, attentive: stillFleeing, fleeing: stillFleeing };
  }
  if (distance < 1.8) return { awareness: 1, attentive: true, fleeing: true };
  const radius = wildlifeNoticeRadius(kind, speed);
  const next = Math.max(
    0,
    Math.min(
      1,
      awareness +
        seconds *
          (distance < radius
            ? 1 / ((speed > SPRINT_REPORTING_SPEED ? 0.8 : 1.6) * (kind.awarenessTimeScale ?? 1))
            : -1 / 2.5),
    ),
  );
  return { awareness: next, attentive: distance < radius * 1.5 || next > 0, fleeing: next >= 1 };
}
