# 0051. A click turns the character, not the camera

**Status:** accepted · **Date:** 2026-09-27

## Context

Decision 0050 freed the mouse and made a left click on the world aim the
camera at whatever was under the cursor. Chris found the camera jumping on
every click disorienting, and asked for only a right-button drag to move the
camera. Asked what a left click should do instead, he chose: the character
turns to face what was clicked, and swings or casts at it, while the camera
stays exactly where it was.

Until now the camera's heading did two jobs. It set which way WASD walks,
and it set which way a swing, a cast, a step-back dodge or a build goes (the
server's `AimYaw`). A click that turns the character without turning the
camera needs those two jobs split.

## Decision

**Each input now carries two headings: `yaw`, where the camera looks, and
`aimYaw`, where the character aims.** Walking is still read against `yaw`,
so W always walks away from the camera. Everything that asks "what is in
front of me" (chopping, catching, casting, dodging back and building) reads
`aimYaw` instead. The input grows from five bytes to seven, still bundled
the same way.

**A standing character turns to face `aimYaw`.** `stepPlayer` already
turned a walking character towards where it walked; standing still, it now
turns at the same rate towards where it aims. Both the server and the
browser's prediction run that same shared function, so the turn is smooth
on screen and everyone else sees it too.

**The browser decides `aimYaw`.** A left click sets it towards whatever is
under the cursor. A small, separately tested module (`input/click-target.ts`)
checks the ray under the cursor against each standing tree (a narrow trunk
plus a wide canopy, so clicking the leaves faces the trunk) and each animal,
and otherwise uses the spot of ground or water it lands on. As soon as the
player walks, the click is let go and the character aims the way it faces,
which follows the walk. Charging a heavy swing roots the player, so it keeps
the aim it had.

**A held dodge direction is still relative to the camera**, the same as
walking. Only a dodge with nothing held, which steps straight back, reads
the aim.

## Consequences

- Aiming by turning the camera alone no longer works. A player who
  right-drags to look at a tree without walking or clicking still swings
  wherever the character faces. The fix is to click the tree, which is what
  the free mouse is for.
- The on-screen hints (the tree or animal a swing would hit, whether a cast
  would land, whether there is room to build) follow the character's aim
  too, so they always agree with what a click would do.
- A build still lands a fixed distance in front of the player, now in front
  of the character rather than the camera. The build preview that follows
  this change replaces that with placing wherever the mouse points.
- A click only picks a direction. Whether the swing reaches is still the
  same yaw-and-distance check in `packages/shared`, so clicking a tree
  across the clearing turns the character towards it but chops nothing.
