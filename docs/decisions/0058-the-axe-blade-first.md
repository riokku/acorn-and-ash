# 0058. The axe, blade first

**Status:** accepted · **Date:** 2026-10-01

## Context

Chris reported the held axe was "turned backwards still" and asked for it to
be turned 180 degrees, so the blade faces away from the player, and to lean
a bit further forward.

Earlier rounds (decision 0036) fixed which way the _handle_ leaned, but never
which way the _edge_ faced. Measured in the moves gallery, with the knight
standing still the handle leaned about 30 degrees forward while the blade
pointed back at the character. Mid-swing it was worse: at every blow (the
chop, all three combo swings and the charged strike) the edge pointed
against the way the axe head was moving, so each one landed with the back
of the head. The axe model's blade sticks out along its own -X, with the
handle along its own Y, so both problems are the same thing: a half turn
about the handle was missing.

## Decision

The axe gets its own grips instead of sharing the rod and torch's
(`AXE_GRIPS` in `apps/client/src/scene/character.ts`).

- **Carried:** the same upright carry as before, turned half a turn about
  the handle, then tipped a further 15 degrees forward (about 45 degrees off
  vertical in all). Standing, the edge now faces ahead of the character and
  a little down.
- **Swung:** the same half turn about the handle on the grip used for
  moves. Measured again, every blow now travels edge first, and the
  wind-ups and recoveries travel back first, as they should.

The rod, torch and shovel keep their existing grips. Only the axe has an
edge that can face the wrong way, and nobody has asked for those to change.

## Consequences

- Purely visual: nothing about when or where a blow lands has changed.
- The grips are built from named turns (`ABOUT_THE_HANDLE`, `AXE_EXTRA_LEAN`)
  rather than one opaque set of angles, so a "lean it more" or "less" is a
  single number to change.
