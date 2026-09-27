# 0052. A build preview that follows the mouse

**Status:** accepted · **Date:** 2026-09-27

## Context

Until now, picking something from the build menu placed it straight away, a
fixed 2.6 m in front of the player, with no way to see beforehand where it
would land or why it sometimes did not. Chris asked for what other building
games do: pick a fence, see an outline of where it could go (not too close to
other things), then click to place it. He settled the details himself: the
preview follows the mouse, the mouse wheel turns it in 15° steps, fence pieces
snap onto the ends of fences already built (Shift places one freely), pieces
keep a small gap of breathing room, and after placing a fence or a path stone
the preview stays out for the next one.

## Decision

**The client says exactly where and which way; the server still checks it.**
A build request now carries a spot and a turn (`BuildRequest`), not just a
kind. The server builds it there only if the player can afford it, does not
already own one of a capped kind, and `checkBuildSpot` passes: the spot is
within `BUILD_REACH` (5 m, plus a metre of slack for walking between click
and tick), inside the tree line, clear of the water, not on top of the
builder, and `BUILD_SPACING` (0.3 m) clear of every tree, rock, stump and
built piece. The client runs the same check every frame to colour the preview
and put the reason into words.

**A footprint can be a line, not only a circle.** A fence piece is 1.4 m long
and a post wide. A circle covering it would have kept everything a metre away
from the middle of its rails, and would never let two pieces join. So a
buildable can give a `footprintHalfLength`, and every check measures
edge-to-edge distance between lines with width. Two fence pieces may share an
end, as long as they do not fold back sharper than about 60°. Two garden path
stones may touch. Everything else keeps the usual gap.

**Snapping is only a suggestion the client makes.** `snapFence` finds the
fence end nearest the mouse (within 1 m) and lays the new piece from it
towards the mouse, in 15° steps from the piece it joins, so straight runs stay
straight and corners come out square. The server never snaps anything. It
just sees a spot that happens to line up.

**Every built piece remembers its turn**, in a new `yaw` column. Rows saved
before this read as zero, which is how everything was drawn until now. A
cabin's front door, where its owner wakes, turns with it.

**Each player hears which pieces are theirs.** The built-prop list now goes
to each player separately, with their own pieces marked, so the preview can
say "You already have a cabin" instead of showing green for one the server
will refuse. Nobody learns who owns anything else.

**The click that places a piece is never also a swing.** While a piece is
out, the left button's swing and charge are masked off, and the press is
swallowed so that holding it a moment too long does not start a charged
attack. A right-button tap (under 350 ms, barely moved) puts the piece away,
as does Escape. A right-button drag still turns the camera.

**A piece just placed counts as standing straight away**, for up to three
seconds or until the server confirms it. A second click on the same spot
shows red immediately, and the next fence piece can snap onto the one just
laid without waiting for the round trip.

## Consequences

- Built pieces still have no collision, so the "not on top of the builder"
  rule is about appearance, not getting stuck. Other players are not checked
  for the same reason.
- The preview works out the ground under the mouse from a flat plane at
  height zero. That is exact in the clearing, which is the only place
  building is allowed.
- The build message grew from 2 bytes to 8, and each built prop from 8 bytes
  to 10. Both are sent rarely.
