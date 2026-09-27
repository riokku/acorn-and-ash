import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WORLD_SEED,
  EXPLORE_REVEAL_RADIUS,
  POND,
  createExploredMap,
  revealAround,
} from '@acorn/shared';

import { compassTo } from '../src/hud/cache-compass';
import { fogCover } from '../src/map/fog';
import { MapFeed } from '../src/map/map-feed';
import {
  arrowTurn,
  bigMapPoint,
  bigMapWorldAt,
  clampToRim,
  minimapOffset,
  zoomAbout,
} from '../src/map/map-math';
import { MAP_HALF_EXTENT, mapWorldFromSeed, paintWorldMap } from '../src/map/paint-map';

describe('the minimap', () => {
  it('puts whatever is ahead of the camera at the top', () => {
    for (const cameraYaw of [0, 0.7, -2.1, Math.PI]) {
      // Ahead of a camera at yaw θ is (-sin θ, -cos θ): yaw 0 looks down -Z.
      const ahead = minimapOffset(-Math.sin(cameraYaw) * 10, -Math.cos(cameraYaw) * 10, cameraYaw);
      expect(ahead.x).toBeCloseTo(0, 6);
      expect(ahead.y).toBeCloseTo(-10, 6);
    }
  });

  it('puts whatever is to the right of the camera on the right', () => {
    // Looking down -Z, +X is on the right.
    const right = minimapOffset(5, 0, 0);
    expect(right.x).toBeCloseTo(5, 6);
    expect(right.y).toBeCloseTo(0, 6);
  });

  it('agrees with the stash compass about which way things are', () => {
    const cameraYaw = 1.1;
    const from = { x: 3, z: -2 };
    const to = { x: -20, z: 14 };
    const onMap = minimapOffset(to.x - from.x, to.z - from.z, cameraYaw);
    const bearing = (compassTo(from, to, cameraYaw).bearingDegrees * Math.PI) / 180;
    // A bearing is clockwise from straight up, the same as the map's own angle.
    expect(Math.atan2(onMap.x, -onMap.y)).toBeCloseTo(bearing, 6);
  });

  it('points your arrow up when you face the way the camera looks', () => {
    expect(arrowTurn(0.4, 0.4)).toBe(0);
    // Facing a quarter turn to the left of the camera points it left, anticlockwise.
    expect(arrowTurn(0.4 + Math.PI / 2, 0.4)).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('keeps something far away on its rim, pointing the right way', () => {
    const inside = clampToRim({ x: 10, y: -20 }, 80);
    expect(inside).toEqual({ x: 10, y: -20, onRim: false });
    const beyond = clampToRim({ x: 300, y: -400 }, 80);
    expect(beyond.onRim).toBe(true);
    expect(Math.hypot(beyond.x, beyond.y)).toBeCloseTo(80, 6);
    expect(beyond.x / beyond.y).toBeCloseTo(300 / -400, 6);
  });
});

describe('the big map', () => {
  const view = { centreX: 12, centreZ: -30, pixelsPerMetre: 2.5 };

  it('keeps north up, with the view centred where asked', () => {
    expect(bigMapPoint(12, -30, view, 800, 600)).toEqual({ x: 400, y: 300 });
    const further = bigMapPoint(12, -40, view, 800, 600);
    expect(further.y).toBeLessThan(300);
  });

  it('turns a pixel back into the spot under it', () => {
    const point = bigMapPoint(-7, 55, view, 800, 600);
    const back = bigMapWorldAt(point.x, point.y, view, 800, 600);
    expect(back.x).toBeCloseTo(-7, 6);
    expect(back.z).toBeCloseTo(55, 6);
  });

  it('zooms in about the cursor, leaving whatever is under it in place', () => {
    const limits = { minPixelsPerMetre: 1, maxPixelsPerMetre: 20, halfExtent: MAP_HALF_EXTENT };
    const under = bigMapWorldAt(620, 140, view, 800, 600);
    const zoomed = zoomAbout(view, 2, 620, 140, 800, 600, limits);
    expect(zoomed.pixelsPerMetre).toBeCloseTo(5, 6);
    const stillUnder = bigMapWorldAt(620, 140, zoomed, 800, 600);
    expect(stillUnder.x).toBeCloseTo(under.x, 6);
    expect(stillUnder.z).toBeCloseTo(under.z, 6);
    // And never past the most or least zoom.
    expect(zoomAbout(view, 100, 400, 300, 800, 600, limits).pixelsPerMetre).toBe(20);
    expect(zoomAbout(view, 0.01, 400, 300, 800, 600, limits).pixelsPerMetre).toBe(1);
  });
});

describe('the unexplored parchment', () => {
  it('covers everything on a blank map, and uncovers where you have been', () => {
    const resolution = 64;
    const blank = fogCover(createExploredMap(), resolution);
    expect(blank.every((value) => value === 255)).toBe(true);

    const explored = createExploredMap();
    revealAround(explored, 0, 0);
    const cover = fogCover(explored, resolution);
    const pixelAt = (x: number, z: number): number => {
      const px = Math.floor(((x + MAP_HALF_EXTENT) / (MAP_HALF_EXTENT * 2)) * resolution);
      const py = Math.floor(((z + MAP_HALF_EXTENT) / (MAP_HALF_EXTENT * 2)) * resolution);
      return cover[py * resolution + px] ?? -1;
    };
    expect(pixelAt(0, 0)).toBe(0);
    expect(pixelAt(EXPLORE_REVEAL_RADIUS + 20, 0)).toBe(255);
  });
});

describe('the painted map', () => {
  // Small, so the test is quick; the game paints it at MAP_IMAGE_SIZE.
  const size = 160;
  const world = mapWorldFromSeed(DEFAULT_WORLD_SEED);
  const map = paintWorldMap(world, size);
  const colourAt = (x: number, z: number): readonly number[] =>
    map.get(
      Math.floor(((x + MAP_HALF_EXTENT) / (MAP_HALF_EXTENT * 2)) * size),
      Math.floor(((z + MAP_HALF_EXTENT) / (MAP_HALF_EXTENT * 2)) * size),
    );

  it('paints the same page every time', () => {
    expect(paintWorldMap(world, 48).toBytes()).toEqual(paintWorldMap(world, 48).toBytes());
  });

  it('paints the pond blue and the clearing green', () => {
    const pond = POND[0];
    if (pond === undefined) throw new Error('no pond');
    const [pr, pg, pb] = colourAt(pond.x, pond.z);
    expect(pb).toBeGreaterThan(pr ?? 1);
    expect(pb).toBeGreaterThan((pg ?? 1) - 0.02);

    const [gr, gg, gb] = colourAt(-12, 14);
    expect(gg).toBeGreaterThan(gr ?? 1);
    expect(gg).toBeGreaterThan(gb ?? 1);
  });

  it('leaves bare parchment past the edge of the world', () => {
    const [r, g, b] = colourAt(MAP_HALF_EXTENT - 1, MAP_HALF_EXTENT - 1);
    // Warm paper: more red than blue, and not green like the land.
    expect(r).toBeGreaterThan(b ?? 1);
    expect(r).toBeGreaterThanOrEqual((g ?? 1) - 0.01);
  });
});

describe('the map feed', () => {
  it('fills in around you straight away, and takes in the server’s word too', () => {
    const feed = new MapFeed();
    const before = feed.exploredVersion;
    feed.revealAt(0, 0);
    expect(feed.exploredVersion).toBeGreaterThan(before);

    // Standing in the same square again changes nothing.
    const after = feed.exploredVersion;
    feed.revealAt(0.5, 0.5);
    expect(feed.exploredVersion).toBe(after);

    const fromServer = createExploredMap();
    revealAround(fromServer, 100, -100);
    feed.mergeFromServer(fromServer);
    expect(feed.exploredVersion).toBeGreaterThan(after);
    // Merging the same again adds nothing.
    const merged = feed.exploredVersion;
    feed.mergeFromServer(fromServer);
    expect(feed.exploredVersion).toBe(merged);
  });
});
