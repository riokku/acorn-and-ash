# 0006. How a world wakes up, ticks and goes back to sleep

**Status:** accepted · **Date:** 2026-09-17

## Context

Each world is one Durable Object with a 20 Hz tick loop. Durable Objects give us
128 MB of memory and 30 seconds of CPU per event, and they are billed for as long
as they are awake. A timer keeps an object awake, so a forgotten `setInterval`
costs money forever, on every world anyone ever visited.

## Decision

- A world starts its tick loop when the first player connects and stops it the
  moment the last one leaves. `runTick` also stops the loop defensively if it
  ever finds an empty world.
- Sockets are accepted with the WebSocket Hibernation API
  (`ctx.acceptWebSocket`), and each socket carries its network id and player key
  in a serialized attachment. That means the in-memory world can always be
  rebuilt from the sockets plus SQLite if the object is restarted, which
  `ensureSimulation()` does.
- Snapshots go out every second tick, so 10 per second, and each player gets
  their own: interest management means they only hear about players near them,
  and the acknowledged input number is per player.
- The world saves every 30 seconds and whenever a player disconnects.
- Time sent to clients is derived from the tick count, not from a clock. Workers
  freeze `Date.now()` between I/O operations, so a tick-derived clock is both
  more accurate and perfectly monotonic.
- Slow ticks are logged by measuring the gap between consecutive ticks. For the
  same clock-freezing reason the object cannot measure its own CPU time; the gap
  between ticks is what tells us whether the loop is keeping up, which is the
  thing we actually care about.

## Consequences

- An empty world costs nothing.
- The 10 ms tick budget is checked in `tools/load-test/tick-bench.ts`, which runs
  the same simulation under Node where the clock is honest.
- Phase 0 identifies returning players by a key the browser generates and stores.
  Phase 1 replaces it with a real account from Better Auth; the storage schema
  already keys on it.
- If a world ever needs to keep running with nobody in it (crops growing, say),
  this decision has to be revisited, most likely with an alarm rather than a
  timer.
