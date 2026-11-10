/**
 * When a place's name comes up on screen (decision 0293).
 *
 * Walking into a region shows its name large, with the spot you are standing
 * on beneath it if it has one. Walking onto a named spot inside a region shows
 * that spot's name alone, smaller. A place just left is not announced again on
 * stepping straight back in, and a place has to hold for a moment before it
 * counts, so skirting a border does not flicker names on and off.
 *
 * A far-off sight (Ash Peak, from the lake) is shown once in a visit to the
 * world, the first time its viewpoint is reached while the air is clear.
 *
 * Plain values in and out, no clock of its own, so it can be tested.
 */

import { PLACES, SIGHTS, type Place, type PlaceKind, type Whereabouts } from '@acorn/shared';

export interface PlaceBanner {
  /** Counts up with every banner, so the same place shown twice still animates afresh. */
  readonly key: number;
  readonly title: string;
  /** The smaller line beneath, if any. */
  readonly line: string | null;
  readonly kind: PlaceKind;
  /** A region is announced large; a spot inside one, smaller. */
  readonly size: 'region' | 'spot';
}

/** A place has to hold this long before it counts as where you are. */
export const PLACE_SETTLE_MS = 900;
/** A place is not announced again until this long after it was last stood in. */
export const PLACE_QUIET_MS = 3 * 60_000;
/** How long a banner stays up, fades included. The HUD's animation runs to the same length. */
export const PLACE_BANNER_MS = 5200;

export class PlaceTracker {
  private region: Place | null = null;
  private spot: Place | null = null;
  private pendingRegion: Place | null = null;
  private pendingSpot: Place | null = null;
  private pendingSince = 0;
  /** When each place was last stood in. */
  private readonly lastIn = new Map<string, number>();
  private readonly sightsSeen = new Set<string>();
  private bannerUntil = 0;
  private shown = 0;

  /** Forget where we were, as on arriving in a world: the next place is announced. */
  reset(): void {
    this.region = null;
    this.spot = null;
    this.pendingRegion = null;
    this.pendingSpot = null;
    this.lastIn.clear();
    this.sightsSeen.clear();
    this.bannerUntil = 0;
  }

  /**
   * Call every frame out of doors with where the player is. Returns a banner
   * to show the moment one is due, and null the rest of the time.
   */
  update(now: number, where: Whereabouts, canSeeFar: boolean): PlaceBanner | null {
    if (where.region !== this.pendingRegion || where.spot !== this.pendingSpot) {
      this.pendingRegion = where.region;
      this.pendingSpot = where.spot;
      this.pendingSince = now;
    }
    const settled = now - this.pendingSince >= PLACE_SETTLE_MS || this.region === null;
    let banner: PlaceBanner | null = null;
    if (settled && (where.region !== this.region || where.spot !== this.spot)) {
      const newRegion = where.region !== this.region && this.due(where.region, now);
      const newSpot = where.spot !== null && where.spot !== this.spot && this.due(where.spot, now);
      this.region = where.region;
      this.spot = where.spot;
      if (newRegion)
        banner = this.make(where.region.name, where.spot?.name ?? null, 'region', 'region', now);
      else if (newSpot && where.spot !== null)
        banner = this.make(where.spot.name, null, where.spot.kind, 'spot', now);
    }
    if (this.region !== null) this.lastIn.set(this.region.id, now);
    if (this.spot !== null) this.lastIn.set(this.spot.id, now);
    return banner ?? this.sight(now, canSeeFar);
  }

  private due(place: Place, now: number): boolean {
    const last = this.lastIn.get(place.id);
    return last === undefined || now - last >= PLACE_QUIET_MS;
  }

  /** A far-off sight, once the banner for the place it is seen from has had its turn. */
  private sight(now: number, canSeeFar: boolean): PlaceBanner | null {
    if (!canSeeFar || this.spot === null || now < this.bannerUntil) return null;
    for (const { sight, from, line } of SIGHTS) {
      if (from !== this.spot.id || this.sightsSeen.has(sight)) continue;
      this.sightsSeen.add(sight);
      return this.make(PLACES[sight].name, line, 'sight', 'spot', now);
    }
    return null;
  }

  private make(
    title: string,
    line: string | null,
    kind: PlaceKind,
    size: PlaceBanner['size'],
    now: number,
  ): PlaceBanner {
    this.bannerUntil = now + PLACE_BANNER_MS;
    return { key: ++this.shown, title, line, kind, size };
  }
}
