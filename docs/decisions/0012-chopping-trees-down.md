# 0012. Chopping trees down

**Status:** accepted · **Date:** 2026-09-19

## Context

Phase 1 ends when you can chop a tree, log out, come back, and find the stump
still there. Chris settled the shape of it: you need an axe, it takes a few
swings, and you can carry ten logs with the axe counted separately.

## Decision

**Left mouse swings.** Held down it chops at a steady rhythm, because the server
decides how often an axe may swing — 0.45 s apart — rather than however fast
packets arrive.

**Trees differ, in the data table.** A birch is three swings and two logs, a pine
four and three, an oak five and four. Choosing what to chop means something even
before there is anything to build with the wood.

**The swing has to be aimed.** A tree counts as in reach when its bark is within
2.2 m and it is within sixty degrees of where the camera points. Reach is
measured to the trunk's surface, not its middle, so a fat oak is no harder to
get at than a slender birch.

**A felled tree leaves a stump that is really there.** The trunk's collider is
swapped for a much smaller one, on the server and on every client, so you can
walk where the tree stood. The camera's idea of what blocks it is rebuilt at the
same moment, so it stops shying away from a trunk that is gone.

**The server owns every tree.** It keeps the swings taken out of each one and
the set that is down, and writes both the moment a swing lands rather than at
the next save. Nobody should have to chop the same tree twice because a server
restarted.

**A full pack does not save the tree.** It still falls; the logs are simply not
picked up. Felling something and being told "your pack is full" is clearer than
a swing that silently does nothing.

## Consequences

- The wire gained two messages: which trees are down, and a four-byte "a swing
  landed" that goes to everybody, so a tree can shake for whoever is watching.
  The felled list counts trees in one byte, which covers a clearing of about a
  hundred and forty; a bigger world will need two.
- Tree state lives in a map on the simulation keyed by prop id, not on the ECS
  entities the props are spawned as. The id is what storage and the wire both
  use, so a map is the thing both ends already agree on.
- Logs that fall from a full pack are gone rather than dropped on the ground.
  Dropped items are worth having; they are not worth having yet.
- Nothing grows back. That is the next change, and it is the reason the
  simulation keeps _when_ a tree fell rather than only _that_ it fell.
- Chopping the ring of trees around the clearing opens gaps you can see through
  but not walk through: the edge of the playable area is a rule, not a fence.
