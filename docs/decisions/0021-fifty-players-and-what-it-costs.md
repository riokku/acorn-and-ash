# 0021. Fifty players, and what it costs

**Status:** accepted · **Date:** 2026-09-23

## Context

Phase 0's own list of things to report on before it counts as done, from the
roadmap: Koota running inside a Durable Object, and tick time and memory
with fifty simulated players. Neither had actually been measured. The tools
for both (`pnpm bench:tick`, `pnpm loadtest`) already existed but had never
been run and written up, so this is that report.

## Decision

**Koota inside a Durable Object is already proven - by the test suite that
already exists**, not a new experiment. Every game-server test runs the real
`WorldSimulation`, Koota underneath, inside the real `cloudflare:test`
Durable Object environment, and has since there was a world worth testing.
Fifty-odd tests exercising it, all green, is the answer.

**Tick time and memory, measured in isolation with `pnpm bench:tick`, have
plenty of room even at the full fifty-player cap.** Run several times for
consistency:

| players | p50 ms | p99 ms   | max ms | heap MB |
| ------- | ------ | -------- | ------ | ------- |
| 1       | ~0.05  | ~0.4     | ~1–4   | ~9–13   |
| 10      | ~0.25  | ~0.9     | ~1–7   | ~11–12  |
| 25      | ~0.6   | ~1.5     | ~2–4   | ~12–15  |
| 50      | ~1.5   | ~3.2–4.1 | ~4–10  | ~11–13  |

Budget is 10 ms a tick and 128 MB a world. At fifty players the simulation's
own arithmetic used at most 41% of the tick budget at the 99th percentile,
and never more than about 13 MB - the one 10 ms `max` reading, once out of
four runs, reads like a single stalled sample rather than a pattern, next to
every other run landing well clear of it.

**Pointing real bots at a real running server told a different story.**
Fifty bots (`pnpm loadtest`) against a local `wrangler dev` server, walking
in circles for a minute, all fifty stayed connected and every one saw the
other forty-nine (once a load-test tool bug counting wildlife as players too
was fixed - see Consequences). But the world server's own tick loop logged
**461 slow ticks in that one minute** - gaps of 60–75 ms where 50 ms was
promised - against **one** slow tick in an identical minute at twenty-five
bots. Snapshots arrived at roughly 8 Hz instead of the intended 10 at fifty
players, rising to 9.6 Hz at twenty-five. The isolated benchmark above never
sees this, because it never opens a real socket: whatever is costing those
extra milliseconds is in real connection handling under load, not the
simulation's own arithmetic, which the benchmark already showed has room to
spare.

**Only tested locally, on purpose.** `wrangler dev` on this machine, not the
real Cloudflare edge. Pointing fifty bots at the shared staging world felt
like the kind of thing to ask about first, not do while nobody was
watching - a natural next step, with Chris's go-ahead.

## Consequences

- Phase 0's two experiments are answered: Koota-in-a-Durable-Object was
  already proven, and the simulation itself is comfortably inside budget at
  fifty players. What the load test turned up instead is new information
  Phase 0 did not ask for and does not yet have a clean answer to.
- Worth a proper look before Phase 5 leans on it: whether the extra cost
  under load is `wrangler dev`'s local mode specifically (production
  Workers may not share its scheduling), the cost of sending a snapshot to
  every connection every tick, or something else, is not yet known. A load
  test against staging is the natural way to find out.
- Fixed one small, real bug this turned up along the way: `pnpm loadtest`'s
  own "players seen" count was quietly counting wildlife too - four dens
  plus fifty players read as "54 players seen". Corrected to count only
  players, which is what it always meant to say.
