import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durationsFromLog, planShards, testListFile, testsFromListReport } from './e2e-shards.mjs';

test('lists every test with its describe titles', () => {
  const report = {
    suites: [
      {
        file: 'sign-in.spec.ts',
        specs: [{ title: 'opens the front page' }],
        suites: [
          {
            title: 'one character per world',
            file: 'sign-in.spec.ts',
            specs: [{ title: 'is kept' }],
          },
        ],
      },
    ],
  };
  assert.deepEqual(testsFromListReport(report), [
    'sign-in.spec.ts › opens the front page',
    'sign-in.spec.ts › one character per world › is kept',
  ]);
});

test('refuses a title the test list format would misread', () => {
  const report = { suites: [{ file: 'a.spec.ts', specs: [{ title: 'left › right' }] }] };
  assert.throws(() => testsFromListReport(report), /cannot express/);
});

test('spreads long tests out instead of keeping them together', () => {
  const tests = ['play › chop', 'play › campfire', 'play › walk', 'pond › bait', 'pond › fish'];
  const durations = {
    'play › chop': 180,
    'play › campfire': 140,
    'play › walk': 30,
    'pond › bait': 50,
    'pond › fish': 40,
  };
  // Not yet recorded, so it counts as the median recorded test (50 s).
  tests.push('zz › shot');
  const shards = planShards(tests, durations, 2);
  assert.deepEqual(
    shards.map((shard) => shard.tests),
    [
      ['play › chop', 'play › walk', 'zz › shot'],
      ['play › campfire', 'pond › bait', 'pond › fish'],
    ],
  );
  assert.deepEqual(
    shards.map((shard) => shard.seconds),
    [260, 230],
  );
});

test('puts every test on exactly one shard', () => {
  const tests = Array.from({ length: 50 }, (_, index) => `t.spec.ts › case ${index}`);
  const durations = Object.fromEntries(tests.map((key, index) => [key, (index * 37) % 120]));
  const shards = planShards(tests, durations, 10);
  assert.deepEqual(shards.flatMap((shard) => shard.tests).sort(), [...tests].sort());
});

test('matches recorded times to tagged tests', () => {
  const tests = ['play.spec.ts › draws the clearing @real-drawing', 'play.spec.ts › walks'];
  const durations = { 'play.spec.ts › draws the clearing': 100, 'play.spec.ts › walks': 10 };
  const shards = planShards(tests, durations, 1);
  assert.equal(shards[0].seconds, 110);
});

test('writes a Playwright test list for one shard', () => {
  assert.equal(
    testListFile({ tests: ['a.spec.ts › suite › case', 'b.spec.ts › other'] }),
    '[chromium] › a.spec.ts › suite › case\n[chromium] › b.spec.ts › other\n',
  );
});

test('reads test times from a CI log', () => {
  const log = [
    'Browser tests (5/8)\tPlay\t2026-11-02T21:00:01Z   ✓   2 [chromium] › e2e/play.spec.ts:322:1 › walking moves the player (34.0s)',
    'Browser tests (5/8)\tPlay\t2026-11-02T21:01:35Z   ✓   3 [chromium] › e2e/play.spec.ts:346:1 › two tabs see each other move (1.6m)',
    'Browser tests (5/8)\tPlay\t2026-11-02T21:02:00Z   ✘   4 [chromium] › e2e/pond.spec.ts:9:3 › pond › a fish bites (retry #1) (2.0m)',
    'Browser tests (5/8)\tPlay\t2026-11-02T21:02:01Z   ✓   5 [chromium] › e2e/pond.spec.ts:9:3 › pond › a fish bites (retry #1) (50.0s)',
    'Browser tests (5/8)\tPlay\t2026-11-02T21:02:02Z   ✓   6 [chromium] › e2e/play.spec.ts:30:1 › draws the clearing @real-drawing (900ms)',
    'Browser tests (5/8)\tPlay\t2026-11-02T21:02:03Z   -   7 [chromium] › e2e/zz-season-shots.spec.ts:21:1 › front page autumn',
    'Browser tests (5/8)\tPlay\t2026-11-02T21:02:04Z [WebServer] ✓ built in 8.79s',
  ].join('\n');
  assert.deepEqual(durationsFromLog(log), {
    'play.spec.ts › walking moves the player': 34,
    'play.spec.ts › two tabs see each other move': 96,
    'pond.spec.ts › pond › a fish bites': 120,
    'play.spec.ts › draws the clearing': 1,
    'zz-season-shots.spec.ts › front page autumn': 0,
  });
});
