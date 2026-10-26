import type { AnimalKindId } from '../data/animals';
import type { WeatherKind } from './weather';

export const TRACKED_ANIMALS = ['rabbit', 'fox', 'elk', 'jackrabbit', 'cedarStag'] as const;
export type TrackedAnimal = (typeof TRACKED_ANIMALS)[number];
export const FRESH_TRACK_SECONDS = 180;
export const MAX_FRESH_TRACKS = 768;
export const MAX_VISIBLE_TRACKS = 96;
export interface FreshAnimalTrack {
  readonly id: number;
  readonly kind: TrackedAnimal;
  readonly x: number;
  readonly z: number;
  readonly yaw: number;
  /** Remaining life, from 0 to 1. Erosion can make this older than its real age. */
  readonly freshness: number;
}
interface TrailAnchor {
  x: number;
  z: number;
  walked: number;
}

/** Short shared history, deliberately ephemeral: no timers or saved animal routes. */
export class AnimalTrailHistory {
  private tracks: FreshAnimalTrack[] = [];
  private readonly anchors = new Map<number, TrailAnchor>();
  private nextId = 1;

  age(seconds: number, weather: WeatherKind): void {
    const erosion =
      weather === 'storm' || weather === 'blizzard'
        ? 6
        : weather === 'rain'
          ? 4
          : weather === 'drizzle'
            ? 2
            : 1;
    this.tracks = this.tracks
      .map((track) => ({
        ...track,
        freshness: track.freshness - (seconds * erosion) / FRESH_TRACK_SECONDS,
      }))
      .filter((track) => track.freshness > 0);
  }
  observe(id: number, kind: AnimalKindId, x: number, z: number, onGround: boolean): void {
    if (!(TRACKED_ANIMALS as readonly string[]).includes(kind)) return;
    const previous = this.anchors.get(id);
    const distance = previous ? Math.hypot(x - previous.x, z - previous.z) : 0;
    if (!previous || !onGround || distance > 3) {
      this.anchors.set(id, { x, z, walked: 0 });
      return;
    }
    const yaw = Math.atan2(-(x - previous.x), -(z - previous.z));
    previous.x = x;
    previous.z = z;
    previous.walked += distance;
    if (previous.walked < 1.6 || distance < 0.001) return;
    previous.walked = 0;
    this.tracks.push({ id: this.nextId, kind: kind as TrackedAnimal, x, z, yaw, freshness: 1 });
    this.nextId = (this.nextId % 65535) + 1;
    if (this.tracks.length > MAX_FRESH_TRACKS) this.tracks.shift();
  }
  forget(id: number): void {
    this.anchors.delete(id);
  }
  near(x: number, z: number): FreshAnimalTrack[] {
    return this.tracks
      .filter((track) => Math.hypot(track.x - x, track.z - z) <= 40)
      .slice(-MAX_VISIBLE_TRACKS);
  }
}
export function freshTrackHint(track: FreshAnimalTrack): string {
  const animal =
    track.kind === 'cedarStag'
      ? 'Old Cedar Stag hoofprints'
      : track.kind === 'elk'
        ? 'elk hoofprints'
        : track.kind === 'fox'
          ? 'fox pawprints'
          : 'rabbit tracks';
  return `${track.freshness > 0.65 ? 'Fresh' : track.freshness > 0.25 ? 'Fading' : 'Faint'} ${animal} · follow their direction and approach quietly`;
}
