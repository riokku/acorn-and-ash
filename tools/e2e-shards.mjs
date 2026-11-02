import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

/**
 * Splits the browser tests across CI shards by how long each one takes,
 * rather than by count. Playwright's own --shard cuts the alphabetical list
 * into equal-sized slices, which put every long play.spec.ts case on one
 * machine (decision 0278).
 *
 *   node tools/e2e-shards.mjs plan 3/10 <list-file>   write shard 3's tests
 *   node tools/e2e-shards.mjs plan all/10             print every shard's estimate
 *   node tools/e2e-shards.mjs record <run-id>...      refresh e2e/durations.json
 */

const DURATIONS_FILE = fileURLToPath(new URL('../e2e/durations.json', import.meta.url));
const PLAYWRIGHT_CLI = fileURLToPath(
  new URL('../node_modules/@playwright/test/cli.js', import.meta.url),
);
const SEPARATOR = ' › ';

/** Every test Playwright would run, as "file › describe › title" keys. */
export function testsFromListReport(report) {
  const keys = [];
  const walk = (suite, titles) => {
    for (const spec of suite.specs ?? []) {
      const path = [suite.file, ...titles, spec.title];
      // The test list format splits on this character, so a title holding it
      // would select the wrong tests.
      if (path.some((part) => part.includes('›'))) {
        throw new Error(`A test title contains "›", which the shard list cannot express: ${path}`);
      }
      keys.push(path.join(SEPARATOR));
    }
    for (const child of suite.suites ?? []) walk(child, [...titles, child.title]);
  };
  for (const file of report.suites) walk(file, []);
  return keys;
}

/**
 * Longest tests first, each to the shard with the least work so far. Tests
 * with no recorded time count as the median one. Every shard computes the
 * same plan from the same commit, so each test lands on exactly one shard.
 */
export function planShards(tests, durations, total) {
  const recorded = (key) => durations[withoutTags(key)];
  const known = tests.map(recorded).filter((seconds) => seconds !== undefined);
  known.sort((a, b) => a - b);
  const typical = known.length ? known[Math.floor(known.length / 2)] : 30;
  const estimate = (key) => recorded(key) ?? typical;

  const shards = Array.from({ length: total }, () => ({ seconds: 0, tests: [] }));
  const longestFirst = [...tests].sort((a, b) => estimate(b) - estimate(a) || (a < b ? -1 : 1));
  for (const key of longestFirst) {
    const lightest = shards.reduce((best, shard) => (shard.seconds < best.seconds ? shard : best));
    lightest.seconds += estimate(key);
    lightest.tests.push(key);
  }
  for (const shard of shards) shard.tests.sort();
  return shards;
}

/** Playwright --test-list lines for one shard. */
export function testListFile(shard) {
  return shard.tests.map((key) => `[chromium]${SEPARATOR}${key}\n`).join('');
}

/** The list reporter prints tags after the title; the recorded times leave them off. */
function withoutTags(key) {
  return key.replace(/( @[\w-]+)+$/, '');
}

/**
 * Seconds per test from the "list" reporter lines in a CI log, such as
 *   ✓  3 [chromium] › e2e/play.spec.ts:346:1 › two tabs see each other move (1.6m)
 *   -  4 [chromium] › e2e/zz-season-shots.spec.ts:21:1 › front page autumn
 * Skipped tests take no time. A retried test keeps its longest attempt.
 */
export function durationsFromLog(text) {
  const line =
    /([✓✘-])\s+\d+ \[chromium\] › e2e\/([^:\s]+):\d+:\d+ › (.+?)(?: \(retry #\d+\))?(?: \((\d+(?:\.\d+)?)(ms|s|m)\))?\s*$/;
  const unit = { ms: 0.001, s: 1, m: 60 };
  const durations = {};
  for (const row of text.split('\n')) {
    const match = row.match(line);
    if (!match) continue;
    const [, mark, file, titles, amount, suffix] = match;
    if (mark !== '-' && !amount) continue;
    const key = withoutTags(`${file}${SEPARATOR}${titles}`);
    const seconds = amount ? Math.round(Number(amount) * unit[suffix]) : 0;
    durations[key] = Math.max(durations[key] ?? 0, seconds);
  }
  return durations;
}

function listTests() {
  const output = execFileSync(
    process.execPath,
    [PLAYWRIGHT_CLI, 'test', '--list', '--reporter=json'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return testsFromListReport(JSON.parse(output));
}

function readDurations() {
  return JSON.parse(readFileSync(DURATIONS_FILE, 'utf8'));
}

function plan(which, outFile) {
  const match = /^(\d+|all)\/(\d+)$/.exec(which ?? '');
  if (!match) throw new Error('Expected a shard such as 3/10 or all/10');
  const total = Number(match[2]);
  const shards = planShards(listTests(), readDurations(), total);
  const minutes = (shard) => (shard.seconds / 60).toFixed(1);

  if (match[1] === 'all') {
    shards.forEach((shard, index) =>
      console.log(
        `shard ${index + 1}/${total}: ${shard.tests.length} tests, about ${minutes(shard)} min`,
      ),
    );
    return;
  }
  const index = Number(match[1]);
  if (index < 1 || index > total || !outFile)
    throw new Error('Expected plan <n>/<total> <list-file>');
  const shard = shards[index - 1];
  writeFileSync(outFile, testListFile(shard));
  console.log(`Shard ${index}/${total}: ${shard.tests.length} tests, about ${minutes(shard)} min`);
}

/** Replaces e2e/durations.json with the times from the given workflow runs. */
function record(runIds) {
  if (!runIds.length) throw new Error('Expected one or more workflow run ids');
  const durations = {};
  for (const runId of runIds) {
    const jobs = JSON.parse(
      execFileSync('gh', ['run', 'view', runId, '--json', 'jobs'], { encoding: 'utf8' }),
    ).jobs.filter((job) => job.name.startsWith('Browser tests'));
    for (const job of jobs) {
      const log = execFileSync('gh', ['run', 'view', '--job', String(job.databaseId), '--log'], {
        encoding: 'utf8',
        maxBuffer: 256 * 1024 * 1024,
      });
      for (const [key, seconds] of Object.entries(durationsFromLog(log))) {
        durations[key] = Math.max(durations[key] ?? 0, seconds);
      }
    }
  }
  const sorted = Object.fromEntries(Object.entries(durations).sort(([a], [b]) => (a < b ? -1 : 1)));
  writeFileSync(DURATIONS_FILE, `${JSON.stringify(sorted, null, 2)}\n`);
  console.log(`Recorded ${Object.keys(sorted).length} test times from ${runIds.length} run(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [command, ...rest] = process.argv.slice(2);
  try {
    if (command === 'plan') plan(rest[0], rest[1]);
    else if (command === 'record') record(rest);
    else throw new Error('Usage: e2e-shards.mjs plan <n>/<total> <list-file> | record <run-id>...');
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
