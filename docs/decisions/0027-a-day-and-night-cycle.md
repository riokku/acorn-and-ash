# 0027. A day and night cycle

**Status:** accepted · **Date:** 2026-09-24

## Context

Chris asked for a day/night cycle and buried items together, right after the
charged attack PR merged. This covers the cycle; buried items - the other
half of the settled Knockout design - is its own follow-up, since it raises
real fairness questions (what gets buried, how you find it again) that the
cycle itself doesn't.

The settled design already answers most of what a first cycle needs: a
20-minute day, and night that never skips in multiplayer.
`DAY_LENGTH_SECONDS` has existed since decision 0024 for exactly this,
unused until now.

## Decision

**Time of day is a pure function of the clock the server already keeps, not
new state.** `WorldSimulation.step` already takes `nowMs` - real wall-clock
time, the same `Date.now()` every tick - so `dayProgress(nowMs)` in
`packages/shared/src/sim/day-night.ts` just reduces it modulo
`DAY_LENGTH_MS`. Nothing is saved, and nothing new goes on the wire: the
client already receives `serverTimeMs` on welcome and every snapshot for its
own interpolation, and now extrapolates that same number forward each frame
(the way `InterpolatedEntities` already does for remote players) to feed the
identical function. Every client in a world computes the same moment from
the same number, so the cycle can't drift or desync between players, and it
can't be skipped or fast-forwarded either - nobody sends a message that owns
it.

**Brightness is a smooth curve, not a switch.** `dayBrightness(progress)` is
a cosine curve peaking at noon and troughing at midnight, so dawn and dusk
are gradients a player can watch happen rather than a sky that snaps between
two states. The client's lighting rig (`apps/client/src/scene/lighting.ts`)
lerps the sky colour, fog colour, hemisphere light and the sun itself
between day and night presets off that one number; the sun doubles as
moonlight at night rather than a separate light being modelled, matching
the placeholder-first approach everything else here has taken. Fog's
near/far distances don't change - a cycle is something to watch, not a way
to quietly cut how far a player can see.

**Night is a plain boolean for now, an even 10 minutes centred on
midnight.** `isNight(progress)` exists mainly for the HUD's new "Time" row
(just "Day" or "Night", read off the same computation) but is exported for
the same reason decision 0024 left `DAY_LENGTH_SECONDS` sitting unused:
gating a threat to night, when that's wanted, is then a data change, not a
new system.

**Nothing about play changes with the cycle yet.** No creature is more
dangerous at night, nothing needs light to see by. This slice is the clock
and the sky it drives; danger keyed to the dark is deliberately left for
whenever that's actually wanted, the same deferral decision 0024 already
made explicit.

## Consequences

- Every world reads the same real wall-clock time, so a second world's
  night lines up with every other world's rather than starting on its own
  offset. That's a deliberate simplicity - a per-world offset is easy to
  add later as one extra stored number, if it turns out worlds should not
  all share one clock.
- A freshly created world can wake up at any point in the cycle, including
  the middle of its own night, rather than always starting at dawn.
- Nothing here persists, so there is nothing to migrate and nothing that
  can desync from a save file.
- Gating threats, visibility, or anything else to night is still to come;
  `isNight` is ready for that but nothing calls it outside the HUD yet.
- The browser check only proves the HUD shows a real value computed from
  the server's clock, not that a full cycle plays out - the same trade-off
  every browser test here makes, and the only one available short of
  watching twenty real minutes pass.
