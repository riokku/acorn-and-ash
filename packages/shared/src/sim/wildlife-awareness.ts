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

/** Additive prey bits in the existing animal action byte; threat attack bits stay unchanged. */
export const PREY_POSE = { tense: 16, fleeing: 32 } as const;
export const WILDLIFE_LISTEN_SECONDS = 2.5;

export interface WildlifeListening {
  readonly sourceId: number | null;
  readonly point: { readonly x: number; readonly z: number } | null;
  readonly remaining: number;
  readonly inRange: boolean;
}
export function quietWildlifeListening(): WildlifeListening {
  return { sourceId: null, point: null, remaining: 0, inRange: false };
}
export interface WildlifeDisturbance {
  readonly id: number;
  readonly x: number;
  readonly z: number;
  readonly distance: number;
  readonly speed: number;
}

/** Remember where a disturbance happened; quiet observers outside sight do not stay tracked. */
export function stepWildlifeListening(
  previous: WildlifeListening,
  source: WildlifeDisturbance | null,
  kind: Pick<AnimalKind, 'alertRadius'>,
  seconds: number,
  fleeingFrom: { readonly x: number; readonly z: number } | null = null,
): WildlifeListening {
  const inRange =
    source !== null && source.distance < wildlifeNoticeRadius(kind, source.speed) * 1.5;
  const firstNotice = inRange && (!previous.inRange || previous.sourceId !== source?.id);
  const heard = inRange && source !== null && source.speed > 0.15;
  const seen = source !== null && source.distance < wildlifeNoticeRadius(kind, 0);
  const stimulus = fleeingFrom ?? (firstNotice || heard || seen ? source : null);
  return {
    sourceId: source?.id ?? null,
    point: stimulus === null ? previous.point : { x: stimulus.x, z: stimulus.z },
    remaining:
      stimulus === null
        ? Math.max(0, previous.remaining - Math.max(0, seconds))
        : WILDLIFE_LISTEN_SECONDS,
    inRange,
  };
}
