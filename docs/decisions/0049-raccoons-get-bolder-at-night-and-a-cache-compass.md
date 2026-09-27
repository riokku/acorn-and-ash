# 0049. Raccoons get bolder after dark, and a compass back to a buried stash

**Status:** accepted · **Date:** 2026-09-27

## Context

Chris asked what to build next. Phase 4's own goal is "nights feel tense but
fair," but night had been purely cosmetic since it shipped (decision 0027)
and stayed that way through the torch and real firelight (decision 0047),
which said so outright: "no danger scaling, no creature behaviour change...
gives a player a real reason to have a torch, a lantern or a lit campfire
before it falls" - a reason that didn't actually exist yet. Decision 0024,
introducing the masked raccoon, said the same thing from the other side:
"No day/night cycle exists yet, so the raccoon threatens at any hour. Once a
cycle exists, gating threats to night is a data change, not a new system."

Separately, Chris found it easy to lose track of a knockout's buried cache
(decision 0028) once he had walked away from it - the wilderness runs out
150 m from the clearing, with nothing to navigate by beyond the small mound
itself. Both landed in the same conversation, so they ship together.

## Decision

**A threat's own alertRadius and safeRadius scale up at night, nothing
else.** `NIGHT_ALERT_RADIUS_MULTIPLIER` (1.75) widens both, computed fresh
each tick a threat considers engaging - `nightDetection` in `sim/animals.ts`,
pure and unit-tested on its own the same way `shouldFlee` already is.
Combat itself never changes: chase speed, the wind-up, damage and hits to
defeat are identical at any hour, so the only thing night makes harder is
sneaking past unnoticed, never a fight already under way. That is the
"fair" half of "tense but fair" - Chris can always point to exactly why he
got noticed (he was in the dark, unlit) rather than a hidden roll.

**A player counts as lit, cancelling the whole bonus, by carrying a lit
torch or standing within `LIGHT_SAFETY_RADIUS` (6 m) of a lit campfire or a
built lantern.** `WorldSimulation.isPlayerLit` checks the equipped item
first (cheap, no loop), then the built-props list - skipping an unlit
campfire, since decision 0033 made that a real toggle, but never skipping a
lantern, which decision 0047 gave no toggle to begin with. One radius for
both built kinds rather than one apiece, roughly between the lantern's own
light (5 m) and the campfire's wider one (9 m) in `fire-light.ts`, until a
playtest says the mismatch is worth splitting.

**The raccoon is the only threat there is, so it is the only row this
touches - by construction, not a special case.** `nightDetection` reads off
`AnimalKind`'s existing `alertRadius`/`safeRadius`, present on every kind,
and only `stepThreatAnimal` ever calls it, which only ever runs for a kind
with a `threat` block. A second threat kind (bandits, per the roadmap) is
bolder at night for free, the same "a second threat kind reuses everything
here as-is" consequence decision 0024 already banked on.

**The buried-cache compass is a client-only reading, no protocol change.**
The server already sends every cache's position and current owner net id to
every connected client (`BuriedCaches`, decision 0028) - nothing about a
mound's location was ever private, only who may dig one up. `compassTo` in
the new `apps/client/src/hud/cache-compass.ts` turns a flat point into a
bearing relative to wherever the camera is currently looking (there is no
true north here) and a distance in metres; `compassToOwnCache` picks the
nearest cache this player owns from the list the client already has. Both
are pure and unit-tested the same way `hint()` already is
(`hud-hint.test.ts`'s own pattern, mirrored in `cache-compass.test.ts`). It
disappears the instant `nearBuriedCache` is true, so it never competes with
the existing "press E to dig it up" hint for the same moment.

## Consequences

- Night is a real decision now, not only a look: sneaking somewhere unlit
  after dark costs real margin, and a torch, a campfire or a lantern buys it
  back. Worth Chris's own read on whether 1.75x reads as "tense" or just
  "annoying" once he has actually played a few nights against it.
- A bandit or any future threat (per the roadmap) inherits bolder-at-night
  for free, and inherits the light-cancels-it escape hatch the same way,
  since both key off the same `threat` block every hostile kind already has.
- `LIGHT_SAFETY_RADIUS` is one number for the campfire and the lantern,
  which sit at different real light distances client-side (9 m and 5 m). If
  a lantern ever reads as "shouldn't have counted from there," that is the
  first place to look.
- The compass only ever points at the nearest cache a player owns. Nothing
  caps how many a player can have buried at once, so a second one stays a
  plain mound to stumble on the normal way until the first is dug up.
- Nothing here changes what a knockout costs or how a cache is dug up -
  only how easy the walk back is to find.
