import { InterpolatedEntities } from './interpolated-entities';

/** Shared presentation timing for actors controlled by the server, never the local player. */
export function createRemotePlayback(): InterpolatedEntities {
  return new InterpolatedEntities({ delaySeconds: 0.18, smoothClock: true });
}
