# 0099 · Mature reeds

## Context

The reeds you could cut for rope ([decision 0091](0091-reeds-and-rope.md)) were six fixed clumps that looked like the scenery reeds around them and grew back in the same place after a few minutes. Chris asked for only some reeds to be gatherable, for those to stand out, to be called **mature reeds**, and for them to come back somewhere around the water on a random timer of about twenty minutes.

"The pond" could mean the small pond in the clearing or the big lake in the north-east. The lake is where the reeds already are, and it is the only water the rowboat can use, so the mature reeds live there. The places a bed can return to are one list (`REED_SHORE_SPOTS`), so the clearing's pond could be added to it later without changing how anything else works.

## Decision

- **Mature reeds are the cuttable ones.** All other reeds at the lake are scenery. Mature reeds are drawn taller (about 2 m) and golden, with fat brown cattails, so they can be picked out across the water. Hovering one says "Mature reeds", and the hint says "gather mature reeds".
- **A bed that is cut clean comes back somewhere else.** It waits a random 15–25 minutes (worked out from the world's seed, in real time, so a world nobody is in still has them back when somebody returns). It then returns to a different place on the shore, at least 10 m from where it was, a fresh two to six reeds.
- **Where they can return to** is every spot on the open bank of the lake, about every 6 m (`world/reeds.ts`). A bed keeps 14 m from any other bed that still has reeds, so they stay spread round the shore. It will not return onto a boat, a build, or a tree. If nowhere is free, it stays where it was.
- **The six starting beds are unchanged**, so a new world looks the same as before until the first one is cut.
- Boats and builds keep clear of the beds *where they stand now*, not where they began.
- Previews and local runs use 45–75 seconds instead (`WORLD_REED_REGROW_SECONDS`), the same way the other timers are shortened.
- The server saves each bed's place, so a bed that moved is still there after a restart. A saved place that is not on the shore is ignored.

## Consequences

- Rope now takes some looking: when the nearest beds are cut, the next ones may be a walk away round the lake. Chris should say if twenty minutes feels too long or too short; the numbers are in `constants.ts`.
- Reeds are no longer rooted. The old rule that a bed always grows back where it stood is gone.
- The server only says where each bed is and how many are left, as for every other patch. Nothing new goes over the wire.
