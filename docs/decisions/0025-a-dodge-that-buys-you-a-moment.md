# 0025. A dodge that buys you a moment

**Status:** accepted · **Date:** 2026-09-23

## Context

With the masked raccoon out (decision 0024), Chris picked the dodge as
Phase 4's next slice - the third piece of the settled Combat design, after
the light attack and the wind-up itself. Two questions came back before any
of it was built:

- **Which slice next:** dodge, over deepening this fight further (a charged
  attack) or widening it (buried items, a second creature).
- **What a dodge actually buys you:** briefly untouchable, a real defensive
  move that can save you even mid wind-up - not only a faster way to walk
  out of reach, which today's only defence (backing away in time) already
  covers.

## Decision

**A dodge is an instant step, not a steered burst.** On a fresh press it
moves the player `DODGE_DISTANCE` (4 m) in whatever direction is held, or
straight back if nothing is, resolved against collision the same way
ordinary movement is - not a few ticks of locked-in velocity decaying back
to normal. This sidesteps needing any new per-tick state on `PlayerMotion`
itself (jump's own home): the whole thing is a position nudge plus a
cooldown and a timer, both kept on the same `PlayerRuntime` a swing's own
cooldown already lives on.

**The direction math already existed inside `stepPlayer` - it is pulled out
as `worldMoveDirection`, not duplicated.** Turning a held key and the
camera's heading into a world-space direction was inline in `stepPlayer`
itself; a dodge needed the exact same conversion, just applied once instead
of accumulated into velocity every tick. Extracting it is a same-behaviour
refactor (the full movement suite still passes unchanged) that a second
call site would otherwise have had to copy by hand.

**Held, not clicked - the same as chopping, not casting.** A swing already
draws exactly this distinction: holding the button chops on its own rhythm,
while a cast wants a fresh click. A dodge has nothing that needs a "fresh
press" the way a cast's timing does, and its own cooldown already stops it
firing faster than `tryDodge` allows - so it reads `isHeld` the same as
chopping does, with no press/release bookkeeping of its own to get wrong.
The first version tried edge-detecting a fresh press anyway, the way a cast
does, and broke the moment a test (or a player) went quiet for a tick with
the key still notionally down: nothing in an idle tick ever clears "was this
already held", so a second real press right after could look like the same
one still in progress. Held-checking has no such gap.

**Untouchable for `DODGE_INVULNERABLE_SECONDS` (0.35 s), gated by
`DODGE_COOLDOWN_SECONDS` (1.2 s) before another can start.** `damagePlayer`
checks a plain `invulnerableUntilMs` deadline before it does anything else -
inside that window, a hit that would have landed is reported back as
`dodged: true` on the same `HealthEvent` a knockout already rides, rather
than a message of its own. In practice the two defences - distance and
timing - mostly overlap anyway: `DODGE_DISTANCE` is large enough next to
the masked raccoon's `attackRadius` that a dodge usually carries a player
out of reach outright. The untouchable window is what still saves them the
times it does not - stepping toward a threat rather than away, or simply
not having covered quite enough ground - which is exactly the case the
tests aim at, since only that case tells the two defences apart.

**Left Ctrl, a key nothing else in the game uses yet.** No fresh design
question needed here - the same kind of call as which key crafting or the
build menu landed on, mine to make the way those were.

**The one browser test proves the key works, not the fight.** Decision
0024 already spent real time learning this the expensive way: fighting a
raccoon all the way down live cost several minutes an attempt and, in a bad
sandbox, sometimes did not finish at all. A dodge does not need a raccoon
to prove its own wiring at all - press Left Ctrl on open ground and check
the player moved - so this one skips the lesson rather than relearning it.
Whether a well-timed dodge actually beats a wind-up is already proven
directly, and quickly, by the shared suite's own tick-exact tests.

## Consequences

- A charged attack is still the one piece of Combat not yet built.
- `DODGE_DISTANCE` and `attackRadius` being close in size means a dodge
  timed early tends to also solve distance, making the untouchable window
  easy to overlook while playing. Worth watching once Chris has spent real
  time with it - a slower dodge, or a longer-ranged threat, would separate
  the two more clearly if that turns out to matter.
- `worldMoveDirection` is now shared surface: a future change to how input
  becomes a world direction (an aim-assist, a slope adjustment) only has one
  place to change, but also means both movement and dodging inherit it
  together.
