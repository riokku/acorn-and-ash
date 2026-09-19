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

### What I could not verify, and what Chris should do

I could not test real WebGPU, Firefox or Safari: there is no GPU on this machine
and neither browser is installed on it. This is a five-second check in a browser
and I would rather you did it than I guessed.

1. Open the preview link.
2. Look at the **Renderer** line in the panel, top left.
3. Do it again in Chrome, Firefox and Safari.

| Browser | Renderer line says | Notes |
| ------- | ------------------ | ----- |
| Chrome  |                    |       |
| Firefox |                    |       |
| Safari  |                    |       |

Either answer is a pass — WebGPU means you got the fast path, WebGL 2 means the
fallback did its job. What would be a _failure_ is a black screen or an error,
and that is what to shout about.

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

## In short

| Experiment                | Verdict                                                                                                      |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| WebGPU fallback           | Fallback verified end to end. WebGPU itself needs a look in a real browser — the HUD says which one you got. |
| Koota in a Durable Object | Works. No WebAssembly problem, small, fast.                                                                  |
| 50 players                | 0.40 ms mean tick against a 10 ms budget, 12 MB against 128 MB, no dropped snapshots. Plenty of room.        |
