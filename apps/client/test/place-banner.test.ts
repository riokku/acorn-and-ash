import { describe, expect, it } from 'vitest';

import { PLACES, type Whereabouts } from '@acorn/shared';

import {
  PLACE_BANNER_MS,
  PLACE_QUIET_MS,
  PLACE_SETTLE_MS,
  PlaceTracker,
} from '../src/hud/place-banner';

const forest: Whereabouts = { region: PLACES.evergreenMountains, spot: null };
const home: Whereabouts = { region: PLACES.evergreenMountains, spot: PLACES.acornHollow };
const lake: Whereabouts = { region: PLACES.evergreenMountains, spot: PLACES.mirrormere };
const town: Whereabouts = { region: PLACES.evergreenMountains, spot: PLACES.bonehollow };
const plains: Whereabouts = { region: PLACES.sunreachHighPlains, spot: null };
const pass: Whereabouts = { region: PLACES.sunreachHighPlains, spot: PLACES.windbreakPass };

/** Stand somewhere long enough for it to count, and say what came up. */
function settle(tracker: PlaceTracker, from: number, where: Whereabouts, canSeeFar = false) {
  const first = tracker.update(from, where, canSeeFar);
  return first ?? tracker.update(from + PLACE_SETTLE_MS, where, canSeeFar);
}

describe('place banners', () => {
  it('announce the region and the spot together on arriving in the world', () => {
    const tracker = new PlaceTracker();
    const banner = tracker.update(0, home, false);
    expect(banner).toMatchObject({
      title: 'Evergreen Mountains',
      line: 'Acorn Hollow',
      size: 'region',
      kind: 'region',
    });
    expect(tracker.update(16, home, false)).toBeNull();
  });

  it('announce a spot alone, smaller, on walking onto it', () => {
    const tracker = new PlaceTracker();
    tracker.update(0, forest, false);
    expect(settle(tracker, 10_000, lake)).toMatchObject({
      title: 'Mirrormere',
      line: null,
      size: 'spot',
      kind: 'landmark',
    });
  });

  it('mark a dangerous place as one', () => {
    const tracker = new PlaceTracker();
    tracker.update(0, forest, false);
    expect(settle(tracker, 10_000, town)).toMatchObject({ title: 'Bonehollow', kind: 'danger' });
  });

  it('wait for a place to hold before announcing it, so a border does not flicker', () => {
    const tracker = new PlaceTracker();
    tracker.update(0, forest, false);
    expect(tracker.update(10_000, lake, false)).toBeNull();
    expect(tracker.update(10_000 + PLACE_SETTLE_MS / 2, forest, false)).toBeNull();
    expect(tracker.update(10_000 + PLACE_SETTLE_MS, lake, false)).toBeNull();
    expect(tracker.update(10_000 + PLACE_SETTLE_MS * 2, lake, false)).not.toBeNull();
  });

  it('stay quiet on stepping straight back into a place just left', () => {
    const tracker = new PlaceTracker();
    tracker.update(0, home, false);
    expect(settle(tracker, 20_000, forest)).toBeNull();
    expect(settle(tracker, 40_000, home)).toBeNull();
    // Long enough away, and it is announced again.
    const later = 40_000 + PLACE_SETTLE_MS + PLACE_QUIET_MS;
    expect(settle(tracker, later, forest)).toBeNull();
    expect(settle(tracker, later + PLACE_QUIET_MS, home)).toMatchObject({ title: 'Acorn Hollow' });
  });

  it('announce a new region large, with the spot stood on beneath it', () => {
    const tracker = new PlaceTracker();
    tracker.update(0, forest, false);
    expect(settle(tracker, 30_000, pass)).toMatchObject({
      title: 'Sunreach High Plains',
      line: 'Windbreak Pass',
      size: 'region',
    });
    expect(settle(tracker, 60_000, plains)).toBeNull();
  });

  it('give every banner a new key, so the same name can play again', () => {
    const tracker = new PlaceTracker();
    const first = tracker.update(0, forest, false)!;
    const second = settle(tracker, 10_000, lake)!;
    expect(second.key).toBeGreaterThan(first.key);
  });

  it('show Ash Peak once, from the lake, after the lake has had its turn and only in clear air', () => {
    const tracker = new PlaceTracker();
    tracker.update(0, forest, true);
    const arrived = 10_000 + PLACE_SETTLE_MS;
    expect(settle(tracker, 10_000, lake, false)).toMatchObject({ title: 'Mirrormere' });
    // Cloud hides the mountain: nothing to announce.
    expect(tracker.update(arrived + PLACE_BANNER_MS + 100, lake, false)).toBeNull();
    // The air clears while the lake's own banner is still up: wait for it.
    expect(tracker.update(arrived + 1000, lake, true)).toBeNull();
    expect(tracker.update(arrived + PLACE_BANNER_MS + 200, lake, true)).toMatchObject({
      title: 'Ash Peak',
      line: 'Far to the north-east',
      kind: 'sight',
    });
    expect(tracker.update(arrived + PLACE_BANNER_MS * 3, lake, true)).toBeNull();
  });

  it('start afresh in a new world', () => {
    const tracker = new PlaceTracker();
    tracker.update(0, home, false);
    tracker.reset();
    expect(tracker.update(1000, home, false)).toMatchObject({ title: 'Evergreen Mountains' });
  });
});
