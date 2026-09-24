# Phase 0 experiments

Three questions CLAUDE.md asked us to answer before building on this foundation.
Everything below was measured on 17 September 2026 against the code in this
branch. Where I could not measure something, I say so rather than guessing.

---

## 1. WebGPU, and what happens when it is missing

**Question:** does the WebGPU fallback work in Chrome, Firefox and Safari?

### What we built

One build. `WebGPURenderer` uses WebGPU where the browser has it and falls back
to WebGL 2 by itself where it does not — same scene code, same bundle, no
branching in our code.

Two things make this checkable rather than a matter of faith:

- The HUD has a **Renderer** line showing which backend the browser actually
  gave you.
- Adding `?renderer=webgl2` to the URL forces the fallback, so both paths can be
  compared in one browser.

### What I could verify

The build machine has no graphics card, and its headless Chromium has no WebGPU
at all: `navigator.gpu` is simply absent. That turned out to be the useful test,
because **the fallback is the path that could break quietly**.

| Check                                  | Result                                              |
| -------------------------------------- | --------------------------------------------------- |
| Browser with no WebGPU at all          | Fell back to WebGL 2 on its own, game ran           |
| WebGPU refused with `?renderer=webgl2` | Fell back to WebGL 2, game ran                      |
| Errors in the browser console          | None                                                |
| Smoke tests on the fallback path       | 4 of 4 passed, including two tabs seeing each other |

So: a browser without WebGPU gets a working game, silently, with no error and no
special build. That is the thing we needed to know.

### What Chris found on his own machine

I could not test real WebGPU myself: there is no graphics card on the build
machine, and no Firefox or Safari installed on it either. Chris opened the
staging build on his own machine on 19 September 2026.

| Browser | Renderer line says | How we know                                   |
| ------- | ------------------ | --------------------------------------------- |
| Edge    | WebGPU             | Chris checked it                              |
| Chrome  | not checked        | Same engine as Edge, so near-certainly WebGPU |
| Firefox | not checked        | Not installed on the machine he had to hand   |
| Safari  | not checked        | Needs a Mac                                   |

So WebGPU genuinely works on real hardware, and a machine without it still gets a
working game through the WebGL 2 fallback. Both halves of the question now have a
real answer rather than a hopeful one.

Edge and Chrome are the same browser underneath — Chromium, with the same WebGPU
implementation — so Chrome can be treated as near-certain without anybody having
measured it. **Firefox and Safari are different engines with their own separate
WebGPU implementations, and are genuinely unchecked.** Neither blocks Phase 0:
whichever path they pick, the game runs, because the fallback is proven. It is
worth thirty seconds the first time somebody playtests on a different machine.

**One thing to watch as we build:** anything written against a WebGPU-only
feature will break the fallback without any warning. The `?renderer=webgl2`
switch exists so that is cheap to catch. Worth checking both paths whenever we
add a visual effect.

---

## 2. Koota inside a Durable Object

**Question:** does the Koota ECS run inside a Cloudflare Durable Object?

**Answer: yes, with no trouble at all.**

The World Durable Object holds a Koota world containing about 170 scenery
entities plus one per player, and drives them at 20 Hz. Fifteen automated tests
run it inside real workerd — the same runtime Cloudflare uses in production —
including two clients walking around and watching each other.

Worth recording:

- **No WebAssembly.** Koota is plain JavaScript. Workers can only load
  WebAssembly imported at build time, so a library that compiled Wasm at runtime
  would have been a problem. This is not one. That was the main risk and it is
  not there.
- **Size.** The whole game server Worker — Koota, Hono, the shared simulation and
  the Durable Object — uploads at 202 KiB, 43 KiB compressed. Not a concern.
- **Speed.** Querying and updating through `updateEach` allocates nothing per
  player per tick, which is why the numbers in section 3 are what they are.
  Reading a single entity with `entity.get()` does copy, so that is kept out of
  the tick loop and used for saving and for tests.

**The one real surprise, and it is not about Koota:** a Worker cannot time
itself. Cloudflare freezes the clock between I/O operations, so `Date.now()` and
`performance.now()` do not advance during a tick — a Durable Object measuring its
own tick will always read zero. So the World object measures the _gap between_
consecutive ticks instead, which is the number that actually matters: if it grows
past the budget, the loop is falling behind. Real per-tick timings come from the
benchmark in section 3, which runs the same simulation under Node where the clock
is honest.

---

## 3. Tick time and memory with 50 players

**Question:** how long does a tick take, and how much memory does a world use,
with 50 players?

The budget from CLAUDE.md: **under 10 ms per tick**, inside **128 MB**.

### The simulation itself

`pnpm bench:tick` walks a crowd around the clearing for 30 seconds of simulated
time, all of them wandering on their own heading so the collision code has real
work to do, and includes building and encoding every player's snapshot.

| Players |        Mean |         p50 |         p95 |         p99 |       Worst |  Snapshots out |        Heap |
| ------: | ----------: | ----------: | ----------: | ----------: | ----------: | -------------: | ----------: |
|       1 |     0.02 ms |     0.02 ms |     0.05 ms |     0.12 ms |     0.75 ms |       0.4 KB/s |     10.5 MB |
|      10 |     0.07 ms |     0.05 ms |     0.18 ms |     0.45 ms |     1.34 ms |      23.8 KB/s |     10.9 MB |
|      25 |     0.12 ms |     0.13 ms |     0.39 ms |     0.63 ms |     0.78 ms |     143.8 KB/s |     12.4 MB |
|  **50** | **0.40 ms** | **0.39 ms** | **1.06 ms** | **1.26 ms** | **1.95 ms** | **568.4 KB/s** | **11.8 MB** |

With 50 players the worst tick in 600 was **1.95 ms**, and the 99th percentile
sits at **13% of the budget**. Memory is about **12 MB against a 128 MB limit**.

There is a lot of headroom, which there needs to be: Phase 4 adds creatures and
combat, and Phase 5 is where 50 players actually happens.

### The whole thing, end to end

`pnpm loadtest` puts 50 bots through the real stack — WebSockets, the binary
protocol, the Durable Object, interest management — each one walking in a circle
and posting inputs exactly the way a browser does.

|                                |                                           |
| ------------------------------ | ----------------------------------------- |
| Bots connected                 | 50 of 50                                  |
| Snapshots received             | 9.7 per bot per second (10 is the target) |
| Traffic down                   | 10.9 KB/s per player                      |
| Players each bot could see     | 50                                        |
| Time to first snapshot         | 9–113 ms after connecting                 |
| Slow ticks logged by the world | 0                                         |
| Errors                         | none                                      |

The tick loop kept the full rate with 50 players connected. Nothing dropped.

### What these numbers are not

This ran on the build machine against a local Cloudflare runtime, not on
Cloudflare itself. The simulation cost should carry over — it is the same
JavaScript on a similar CPU — but real network latency, real WebSocket costs and
a genuinely cold Durable Object are not in these numbers. The same two commands
can be pointed at staging once it is deployed:

```
pnpm loadtest -- --url wss://acorn-ash-web-staging.workers.dev --bots 50
```

### The one number worth remembering

Outgoing traffic grows with the square of the player count: every player is told
about every other player. At 50 players that is 568 KB/s out of a single world.
It is fine now, and interest management (only telling you about players within
100 m) already caps it once a world is bigger than 100 m across. When Phase 5
arrives, the thing to reach for is sending only what changed rather than every
player's full position ten times a second.

---

## 4. Revisiting tick time, now that there is a game

**Question:** section 3's numbers are from 17 September, when the clearing had
trees and not much else. Do they still hold up now that players fish, hunt,
build, fight, and leave things behind?

Measured on 24 September 2026, the same way as before (`pnpm bench:tick`), but
two real problems turned up first while looking for what would matter most as
a world ages.

### What was actually wrong

The built-things and buried-things lists are both sent in full to every player
on every change, and neither has a cap on how many can ever exist: a campfire
costs no more than four logs and is never removed, and a buried cache never
expires (decision 0028). Auditing that code found:

- **A real bug, not just a slow path.** `encodeBuiltProps`/`encodeBuriedCaches`
  cap a message at 255 entries by taking the _first_ 255 of an append-only
  array. Past that count, everything built or buried afterwards would never
  reach anybody, ever - not slowly, just silently. Fixed to keep the newest
  entries instead: an old campfire aging out of view is a much smaller problem
  than a new one nobody can ever see.
- **A cost that grew with everything ever built, forever.** Checking whether a
  player already owns a capped buildable, finding a player's home, and the
  collision check every new build attempt runs, all looked a built prop up by
  scanning the entire built-props array. Fine at a dozen campfires; not fine
  at a thousand. Indexed built props by id so ownership and home lookups are
  now O(1) - the collision check still has to look at everything on the
  ground, which is unavoidable and, per the numbers below, still cheap enough
  not to matter.

Neither of these showed up in the existing load test, because its bots only
ever wander in circles - nothing has ever built a campfire or buried a cache
during a benchmark run before tonight.

### Fresh numbers

Same player-count sweep as before, now against everything the game has grown
into:

| Players |        Mean |         p50 |         p95 |         p99 |       Worst |  Snapshots out |        Heap |
| ------: | ----------: | ----------: | ----------: | ----------: | ----------: | -------------: | ----------: |
|       1 |     0.06 ms |     0.04 ms |     0.20 ms |     0.43 ms |     1.45 ms |       1.4 KB/s |     13.0 MB |
|      10 |     0.23 ms |     0.21 ms |     0.39 ms |     0.63 ms |     1.24 ms |      36.6 KB/s |     13.1 MB |
|      25 |     0.51 ms |     0.54 ms |     0.71 ms |     1.08 ms |     1.13 ms |     171.2 KB/s |     14.1 MB |
|  **50** | **1.16 ms** | **1.24 ms** | **1.84 ms** | **2.28 ms** | **3.04 ms** | **615.0 KB/s** | **17.4 MB** |

Mean tick time at 50 players roughly tripled since September (0.40 ms → 1.16
ms) - everything the game gained since Phase 0 costs something - but it is
still comfortably inside budget.

New this time: the same 50 players, but with a world that has been lived in -
hundreds or thousands of campfires and buried caches built up over time, well
past what a single message can ever carry:

| Built props (= buried caches) |    Mean |     p99 |   Worst |    Heap |
| ----------------------------: | ------: | ------: | ------: | ------: |
|                             0 | 1.18 ms | 2.50 ms | 3.74 ms | 20.4 MB |
|                           255 | 1.19 ms | 2.53 ms | 3.74 ms | 16.3 MB |
|                          2000 | 1.19 ms | 2.26 ms | 3.50 ms | 17.2 MB |

Flat. A world with 2000 campfires ever built - about eight times what any
single message can carry - costs the same per tick as a brand new one. The
worst case measured all night, anywhere in either sweep, was **3.74 ms**:
**25.3% of the 10 ms budget at the 99th percentile**, and about **20 MB**
against the 128 MB a Durable Object gets. The fixes above did what they needed
to.

### What is still true from before, unchanged

The per-tick player-snapshot bandwidth is still what section 3 already
flagged: it grows with the square of the player count, because interest
management's 100 m radius does not do much when everyone plays within a few
dozen metres of the clearing, which is where the axe, the pond and the build
spots all are. 615 KB/s out of one world at 50 players is not a problem for
today's numbers, but it has not gotten any smaller since September, and it is
the same architectural question the original write-up already named: send
only what changed, or actually partition the world into the 32 m chunks
CLAUDE.md describes - which, as of tonight, turned out to not actually exist
in code. The constant is defined and unused; the 100 m cutoff is real, but
implemented as a distance check against every player and animal, not a
spatial index. Not attempted tonight: tick time has plenty of headroom, and
building a spatial index unsupervised, with nobody available to review it, is
a bigger and riskier change than fits one night's work.

`pnpm loadtest` was not re-run tonight against a live server - it still only
simulates idle movement, so it would not have measured anything the sweep
above does not already cover more directly. Teaching it to actually chop,
gather and build over the real network protocol remains useful future work.

---

## In short

| Experiment                | Verdict                                                                                                                                                                                                                                                                                                                                                                                                        |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebGPU fallback           | Both paths work. WebGPU confirmed in Edge on real hardware, and a machine without it falls back to WebGL 2 and still plays. Firefox and Safari not yet checked.                                                                                                                                                                                                                                                |
| Koota in a Durable Object | Works. No WebAssembly problem, small, fast.                                                                                                                                                                                                                                                                                                                                                                    |
| 50 players                | 0.40 ms mean tick against a 10 ms budget, 12 MB against 128 MB, no dropped snapshots. Plenty of room.                                                                                                                                                                                                                                                                                                          |
| 50 players, revisited     | Now 1.16 ms mean (game has grown since). Fixed a real bug where a long-lived world's built props/caches would silently stop reaching anybody past 255. A world with 2000 of each still costs the same per tick as a fresh one. Player-snapshot bandwidth still grows with the square of player count, unchanged since September - not urgent yet, worth revisiting before real spatial partitioning is needed. |
