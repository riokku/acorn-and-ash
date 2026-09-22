# 0016. Hunger and eating

**Status:** accepted · **Date:** 2026-09-22

## Context

The fishing decision left a gap on purpose: "the pond never runs out, fish
cannot be eaten yet... eating comes with hunger." With chopping and fishing
both in, a caught fish had nothing to do once it was in the pack. Hunger is
also one of the two settled survival stats (cozy-light: hunger and energy
only), so it is the natural next slice, and the smallest one that gives the
fish already in the game a reason to exist.

The open question was what happens when hunger runs out. Chris settled it: a
clear warning, no real penalty. There is no knockout system yet for a
consequence to plug into, and inventing one now would be building ahead of
what the game can back up. Energy - the other settled stat, and what makes
sprinting cost something - is left for its own change later.

## Decision

**Hunger only drains while the world is ticking**, the same as everything
else server-side: a world with nobody in it does not run its tick loop, so
logging off pauses hunger rather than punishing anybody for being away.
Unlike a felled tree, there is no case for it to keep counting in real time
while the world sleeps.

**A full meter takes twenty minutes to run out**, in the real game. Local
runs and previews turn that down to a few minutes, the same trick
`WORLD_REGROW_SECONDS` already uses for trees, so it can be watched instead
of waited out. See `WORLD_HUNGER_EMPTY_SECONDS`.

**Eating reuses the interact button.** Pressing E reaches for whatever is at
your feet first, the same as always; only if that comes up empty does it
reach into your own pack instead and eat something. Common fish go first, so
a full pack of golden carp is not spent a point at a time on topping up.
Every fish restores the same amount for now - one number in the item table,
easy to split apart later once there is a reason to.

**Running out is a nudge, not a penalty.** The meter sits at zero, the HUD
says so plainly, and the hint at the bottom of the screen turns as urgent as
a bite on the line. Nothing else happens. A real consequence is a decision
for whenever there is a knockout system worth attaching it to.

**Hunger is only ever told to the player it belongs to.** Unlike a float in
the pond, which everybody standing round it can see, nobody else has any
reason to know how hungry somebody else is, or what they just ate.

## Consequences

- One more small message: five bytes, sent to one player at a time, whenever
  their hunger crosses a whole point or they eat.
- Eating updates the pack in the same moment it updates hunger, the same as
  every other way the pack changes.
- Saved per player, the same as position and what they are carrying. A
  player saved before this release has no hunger on record and starts full,
  the same as anybody arriving fresh - not zero, and not a reason to punish
  someone for a save from before the meter existed.
- Fish are the only food for now. Nothing else in the item table restores
  hunger, so nothing else can be eaten.
