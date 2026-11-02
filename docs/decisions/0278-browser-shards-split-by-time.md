# 0278 — Browser shards split by test time

## Context

Pull requests ran the browser tests on eight machines with Playwright's
`--shard`, which cuts the alphabetical test list into slices of equal count.
The longest cases sit together in `play.spec.ts` (a tree growing back takes
3 minutes, the campfire and two-player cases 1.5–2.5 minutes), so shard 5 got
all of them. On 2 November 2026 shard 5 ran 22–29 minutes while the others ran
9–19, and it hit the 28-minute `globalTimeout` on three art pull requests whose
tests all passed. Adding machines would not fix this on its own: with count
slices even twelve shards left one at about 21 minutes.

## Decision

- Run the browser tests on ten machines (`Browser tests (N/10)`). The
  `Browser smoke tests` check still passes only when every shard passes.
- Split by time, not count. `e2e/durations.json` holds how long each test took
  in recent CI runs (the slowest of several, so it reflects a slow runner).
  `tools/e2e-shards.mjs plan N/10` lists the tests at that commit, hands the
  longest out first, each to the machine with the least work so far, and writes
  that machine's list for `playwright test --test-list`. Every shard computes
  the same plan, so each test runs exactly once; a new test with no recorded
  time counts as a typical (median) one.
- `node tools/e2e-shards.mjs record <run-id>...` refreshes the times from the
  logs of finished pull request runs. Refresh it when shards drift apart.
- Limits are unchanged: 35 minutes per job, 30 for the test step, 28 for
  Playwright's `globalTimeout`.

## Consequences

From the recorded times each shard holds about 13.5 minutes of tests plus about
two minutes of setup, against 25 minutes for the old shard 5. Every test still
runs, with the same retry. Two more machines per pull request mean a little
more setup time in total and more jobs queued when many pull requests run at
once. The times file goes stale as tests change; that only unbalances the split
gradually, never skips a test.
