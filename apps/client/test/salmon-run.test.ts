import { describe, expect, it } from 'vitest';

import {
  LAKE,
  STREAM,
  WORLD_EVENTS,
  isInStream,
  overlapsLake,
  streamSurfaceAt,
  type WorldEventNow,
} from '@acorn/shared';

import {
  SHOAL_SIZE,
  leaperAt,
  riverAt,
  shoalAt,
  swimmerAt,
  swimmerCount,
} from '../src/art/salmon-run';
import { WorldEventWatcher } from '../src/hud/world-event';

describe('the salmon in the river', () => {
  it('are the same for everyone at the same moment', () => {
    expect(swimmerAt(7, 123.4)).toEqual(swimmerAt(7, 123.4));
    expect(leaperAt(2, 55.5)).toEqual(leaperAt(2, 55.5));
    expect(shoalAt(3, 9)).toEqual(shoalAt(3, 9));
  });

  it('swim in the water of the river, just under its surface', () => {
    let seen = 0;
    for (let index = 0; index < swimmerCount(); index++) {
      const pose = swimmerAt(index, 300);
      if (pose === null) continue;
      seen++;
      expect(isInStream(STREAM, pose.x, pose.z, -0.6)).toBe(true);
      expect(Number.isFinite(pose.y)).toBe(true);
    }
    expect(seen).toBeGreaterThan(swimmerCount() * 0.8);
  });

  it('make their way upstream', () => {
    // Find a swimmer in open water and see where it is a few seconds on.
    const index = Array.from({ length: swimmerCount() }, (_, i) => i).find(
      (i) => swimmerAt(i, 100) !== null && swimmerAt(i, 104) !== null,
    )!;
    const before = swimmerAt(index, 100)!;
    const after = swimmerAt(index, 104)!;
    // Upstream is uphill: the water is higher further up the river.
    expect(after.y).toBeGreaterThanOrEqual(before.y - 1e-6);
    expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(1);
  });

  it('leave the waterfalls to the leapers', () => {
    for (let index = 0; index < swimmerCount(); index++)
      for (const seconds of [0, 37, 211]) {
        const pose = swimmerAt(index, seconds);
        if (pose === null) continue;
        for (const fall of STREAM.falls) {
          const at = riverAt(fall.at);
          expect(Math.hypot(pose.x - at.x, pose.z - at.z)).toBeGreaterThan(1.5);
        }
      }
  });

  it('leap at every waterfall, rising clear of the water and coming back to it', () => {
    for (let fall = 0; fall < STREAM.falls.length; fall++) {
      let leaps = 0;
      let highest = 0;
      for (let seconds = 0; seconds < 120; seconds += 0.05) {
        const pose = leaperAt(fall, seconds);
        if (pose === null) continue;
        leaps++;
        highest = Math.max(highest, pose.y - streamSurfaceAt(STREAM, STREAM.falls[fall]!.at + 3.2));
      }
      expect(leaps).toBeGreaterThan(100);
      // Higher than the fall itself at the top of a leap that clears it.
      expect(highest).toBeGreaterThan(STREAM.falls[fall]!.drop);
    }
    expect(leaperAt(STREAM.falls.length, 10)).toBeNull();
  });

  it('gather in a shoal out in the lake at the river mouth', () => {
    for (let index = 0; index < SHOAL_SIZE; index++) {
      const pose = shoalAt(index, 42);
      expect(overlapsLake(LAKE, pose.x, pose.z, 0)).toBe(true);
      expect(pose.y).toBeLessThanOrEqual(LAKE.level);
    }
  });
});

describe('what the HUD says about a world event', () => {
  const run: WorldEventNow = { event: WORLD_EVENTS.salmonRun, endsInMs: 30 * 60_000 };

  it('says nothing when nothing is on', () => {
    const watcher = new WorldEventWatcher();
    expect(watcher.update(null, true)).toEqual({ news: null, reminder: null });
  });

  it('announces an event as it begins, once, and keeps a reminder with the time left', () => {
    const watcher = new WorldEventWatcher();
    watcher.update(null, true);
    const began = watcher.update(run, true);
    expect(began.news).toEqual({
      title: 'The Salmon Run',
      line: 'Salmon are running up the Alderwash',
    });
    expect(began.reminder).toEqual({
      id: 'salmonRun',
      name: 'The Salmon Run',
      timeLeft: 'Ends in 30 minutes',
    });
    const later = watcher.update({ ...run, endsInMs: 61_000 }, true);
    expect(later.news).toBeNull();
    expect(later.reminder?.timeLeft).toBe('Ends in 2 minutes');
  });

  it('announces it to somebody who arrives part-way through', () => {
    const watcher = new WorldEventWatcher();
    expect(watcher.update(run, true).news?.title).toBe('The Salmon Run');
  });

  it('waits for the screen to be free before announcing', () => {
    const watcher = new WorldEventWatcher();
    expect(watcher.update(run, false).news).toBeNull();
    expect(watcher.update(run, false).reminder).not.toBeNull();
    expect(watcher.update(run, true).news?.title).toBe('The Salmon Run');
    expect(watcher.update(run, true).news).toBeNull();
  });

  it('says when it is over, and takes the reminder down', () => {
    const watcher = new WorldEventWatcher();
    watcher.update(run, true);
    const over = watcher.update(null, true);
    expect(over.news).toEqual({ title: 'The Salmon Run', line: 'The salmon have gone upstream' });
    expect(over.reminder).toBeNull();
  });

  it('starts afresh in a new world', () => {
    const watcher = new WorldEventWatcher();
    watcher.update(run, true);
    watcher.reset();
    expect(watcher.update(null, true).news).toBeNull();
    expect(watcher.update(run, true).news?.title).toBe('The Salmon Run');
  });
});
