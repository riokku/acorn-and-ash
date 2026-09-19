# 0010. Give the ECS world back when nobody is in it

**Status:** accepted · **Date:** 2026-09-19

## Context

Koota hands out a fixed number of ECS worlds per JavaScript isolate: sixteen.
Ask for a seventeenth and it throws.

We found this by adding tests. The Durable Object test suite creates a world per
test, and the seventeenth test started failing every connection with
`Koota: Too many worlds created`. Durable Objects share isolates, so this is not
only a test problem: a machine that had woken sixteen worlds and let go of none
would refuse to open the next one.

## Decision

`WorldSimulation` gained `dispose()`, which hands its ECS world back.

The World Durable Object calls it when the last player leaves, in the same
breath as saving and clearing its timers. An empty world is about to hibernate
anyway, and `ensureSimulation()` already knows how to rebuild one from storage
and the live sockets, because a Durable Object can be evicted and woken at any
time.

## Consequences

- A server can now open worlds all day: each one gives its slot back when it
  empties, which is also when it stops costing anything.
- Sixteen _simultaneously busy_ worlds in one isolate is still the ceiling. We
  have not seen it, and we do not know how aggressively production packs
  Durable Objects into isolates, so this is a thing to watch rather than a thing
  to design around yet. If it ever bites, the symptom is unmistakable: new
  worlds refuse to open with that exact message.
- Tests that build more than a few worlds have to dispose of them. The shared
  test suite does it in an `afterEach`.
- Nothing else in the code may hold a `WorldSimulation` past its usefulness.
