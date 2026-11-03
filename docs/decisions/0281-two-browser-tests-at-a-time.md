# 0281 — Two browser tests at a time, and no effect warm-up without drawing

## Context

On 3 November 2026 the ten browser shards took 8–15 minutes each (123 minutes
of tests in all, 240 tests), and the slowest shard set how long a pull request
waited. Nearly every test spends 25–40 seconds loading the world before it
checks anything. A CPU profile of one load, with drawing switched off
(decision 0100), showed where that goes: about 19 seconds preparing shaders for
the first frames, 8–9 of them in the effect warm-up (`rehearseEffects`), and
about 14 seconds computing the terrain and grass. Almost all of it runs on one
processor core, while CI machines have four. Each shard ran one test at a time.

## Decision

- Each shard runs two tests at once (`workers: 2` in `playwright.config.ts`,
  overridable with `E2E_WORKERS`). Tests already use their own worlds, or a
  fake world inside the test, so two at once do not meet.
- When a test switches drawing off, the game skips the effect warm-up. The
  warm-up only hides a stutter the first time an effect is drawn on screen;
  with nothing drawn there is nothing to hide. Tests tagged `@real-drawing`,
  galleries and screenshot runs still warm up as players do.
- `e2e/durations.json` is refreshed from three recent runs so the shards stay
  balanced (decision 0278).
- `E2E_PORT` lets a second checkout run the tests beside a server already on 8787.

## Consequences

On the first pull request run (PR 398) the shards took 6.3–10.5 minutes
instead of 8.2–15.1. The longest browser job went from 16.0 to 11.4 minutes,
and test time across all shards from 123 to 87 minutes. Every test still runs
with the same checks and the same retry. Because two tests share a machine,
each one takes longer on its own (39 seconds on average instead of 28). Three
tests that load the world twice came close to the 90-second default limit, so
they now get 180 seconds, like most tests that load the world. A new test
that loads the world more than once may need the same. Tests that really draw
slow down the most, because drawing on the processor uses several cores: the
mountain-ground drawing test went from 2 to over 3 minutes and now gets 6.
Making the terrain itself faster to compute would help both tests and players;
that is game work for its own pull request.
