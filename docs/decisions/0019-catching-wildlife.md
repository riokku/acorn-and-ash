# 0019. Catching wildlife

**Status:** accepted · **Date:** 2026-09-23

## Context

0018 shipped a rabbit that ambles near its den and bolts when a player gets
close, but left it uncatchable on purpose - wandering and fleeing was
already enough new ground for one change. This is the second half it
promised: catching one with the axe, per Chris's choice recorded there,
needing a reach check against a moving target, an item it gives up, and a
respawn.

## Decision

**The axe's own swing does the catching.** `trySwing` already chose between
a tree and nothing; it now chooses between a tree, an animal, and nothing,
in that order. A tree in reach always wins - the same way a tree already
wins over a cast in `tryCast` - though that tie cannot actually happen
today: dens sit well past the clearing's own tree line, and wilderness
trees are collision-only scenery, never a chopping target, per 0015.

**Reach is judged the same way a tree's is**, in a new `sim/hunting.ts` next
to `sim/chopping.ts`: roughly in front of the camera and within
`CHOP_REACH`, reusing the constant and the facing-cosine test rather than
inventing a second reach rule. Unlike a tree there is no trunk radius to
add - an animal has no collider yet - so reach is measured straight to
wherever it is standing right now, not to a fixed point.

**What a catch pays out is content as data**: a `catchItem` on `AnimalKind`,
the same way a tree's `logs` already is. A rabbit gives meat, worth more
hunger than a fish (50 against 40) since a catch takes an actual chase,
unlike a fish that only takes a click at the right moment.

**Caught, it goes back to its den after `ANIMAL_RESPAWN_SECONDS`** (60,
short enough a session never runs out of rabbits, long enough a den costs
something) **- a plain deadline, handled the way a tree's regrowth already
is**: checked and caught up in one jump if a world was asleep when it
passed, never ticked down. Unlike a tree there is nothing to redraw at a
new size; it simply reappears, calm, at the den.

**Told privately, the same shape as a craft**: a `Caught` message (5 bytes)
to only the player who caught it, then their pack. Nobody else has any
reason to know what somebody else just caught, and the animal vanishing is
already plain to everybody else from the next snapshot - it is simply left
out of it from then on, the way a taken pickup already is.

**The client hints it the same way it already hints a tree**: aiming at a
catchable animal shows its name and offers the swing, and a tree in reach
still wins the hint too. A cast is turned away under the same rule a tree
already turns one away by, now reading "an axe has something to swing at"
rather than only "a tree."

## Consequences

- The respawn wait is a plain constant, not a per-world override the way
  `WORLD_REGROW_SECONDS` and `WORLD_HUNGER_EMPTY_SECONDS` are for tests -
  the game-server tests that prove a catch reaches a real client do not
  need to sit through a real minute to do it; the timing itself is already
  proven precisely at the simulation level, against a clock the test
  controls.
- A second animal kind will need its kind to travel over the wire once one
  exists; today the client's aim hint only ever assumes "rabbit," the same
  caveat 0018 already left for drawing one.
- The browser test walks all the way out to a den - fifty-odd metres past
  the clearing, well beyond the short trips the axe or the pond ever
  needed - and that surfaced two things worth knowing for the next test
  that walks this far: many short polls between small steps cost more in
  browser round trips than the walk itself does once the render loop is
  under load, so the walk holds sprint in long, undivided stretches
  instead; and a straight line to a den can walk a player straight into a
  rock or a trunk out in generated wilderness, so it sidesteps once it
  notices it has stopped making progress, the way a person would.
