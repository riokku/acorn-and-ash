# 0059. Creeping through a charge

**Status:** accepted · **Date:** 2026-10-01

Changes one part of [decision 0026](0026-a-charged-attack-that-finishes-the-job.md):
charging no longer roots you to the spot.

## Context

Chris asked for the player to be able to move slowly while charging a
strong attack. Until now, winding up a charge planted your feet for the
whole second, so anything that moved out of reach while you charged was
gone for good.

## Decision

**A new footing, `creeping`**, in `sim/actions.ts`, for every tick of the
wind-up. It walks at `CHARGE_WALK_SHARE` of walking pace (a third, so
1.5 m/s), with no sprinting or jumping. It is scaled after a diagonal is
evened out, so creeping diagonally is no quicker. The strike itself still
plants your feet once the charge goes off, and a dodge still can't get you
out of the wind-up.

It lives in the shared rules (`footedInput`), so the server and your own
browser's prediction move you exactly the same way.

**You face the way you creep, and the slam lands that way.** This is the
same rule as ordinary walking. Walking during a charge releases a clicked
aim, just as it does when standing about. The alternative, keeping your
facing and sidestepping like Zelda, would need side and backward walking
animations we don't have yet. Chris can ask for it.

**Arms charging, legs walking.** The wind-up pose comes in an upper-body
half as well, and a move can now say its legs are free (`legsFree` on the
pose). As you pick up speed, the legs hand over from the crouch to the walk
underneath while the arm stays wound back. The walk cycle now slows down
far enough to match a creep without the feet sliding. The moves gallery has
a `creep` demo (`?gallery=moves&demo=creep`).

## Consequences

- A charge is less of a gamble against something that wanders off, but it
  is still a commitment: no running, jumping, dodging or blocking.
- The hint while charging reads "you can only creep" instead of "rooted to
  the spot".
