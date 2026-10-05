# 0098 · Every tree can be chopped

## Context

Only the clearing's own trees (about 40) could be chopped. The roughly 1,200 trees of the wilderness around it were scenery: Chris swung at them and nothing happened, and said every tree should be choppable ([decision 0015](0015-wilderness-beyond-the-clearing.md) had left them as scenery).

Doing it for the whole forest costs more than it sounds. The server kept a tree's state in lists the size of the clearing, sent the full list of felled trees on every change, and re-saved every changed tree on every save. Rebuilding the camera's idea of "what is in the way" for the whole forest took 30–90 ms, which is a visible hitch each time a tree falls.

## Decision

- Forest trees use the same rules as the clearing's: the same swings, stump, logs, fall, and regrowth (30–60 minutes on a real world, two minutes on previews, and a tree waits until nobody is standing on its spot). Rocks stay as scenery.
- Forest trees get ids from 1000 up, so they can never be confused with the clearing's. Tree ids are 16-bit on the wire, so there is room for 65,000.
- Both groups share one tree-state table on the server. Tree changes are **only what changed**: a chop sends and saves that one tree, not the whole list. Players still get the whole list once, on arrival, and a flag on the message says which kind it is. Older saved worlds load unchanged.
- Logs from a felled forest tree land clear of the neighbouring trunks, so they can never drop inside another tree.
- On the client, the forest's camera blockers are split into 48 m squares. A tree coming down rebuilds only its own square (a millisecond or two), not the whole forest.

## Consequences

- Chris can chop anywhere. The forest can be thinned out; trees come back on the same timer as the clearing's, so it never stays bare.
- The saved state of a world grows with how many trees have been felled, not with how many exist.
- Messages about trees are slightly bigger per entry, but far fewer of them are sent.
- Interest management (only sending trees near each player) is still the long-term plan for many players; it is not needed yet, because only changed trees are sent.
