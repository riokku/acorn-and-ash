# 0054. A minimap, and a map that fills in as you explore

**Status:** accepted · **Date:** 2026-09-27

## Context

Chris asked for a minimap showing where your home and your stash are. Asked
directly, he chose:

- a round minimap in a corner, turning with the view, so what is ahead is at the top;
- a big map on M as well, filling in only as you explore, remembered on your character;
- both painted like a page of the field journal;
- showing your home, your stash, other players, what you have built, and the land.

The only way back to a stash so far was the compass arrow from decision 0049.

## Decision

**The map is painted from the seed, the same way the world is built.**
`map/paint-map.ts` builds the clearing, the hills and the wilderness from the
world's seed and paints them with the kit from decision 0053. The page is
parchment, and grass and forest floor are watercolour washes coloured by the
same ground shading the 3D ground uses, so map and world agree. The pond gets
a darker rim where the paint pooled, the hills get faint ink contour lines,
every tree and rock is a painted blob (a little larger than life, the way map
symbols are), and a dashed line marks the edge of the world. Nothing about it
travels over the wire. A 1024-pixel page takes about half a second and is
painted in a worker, so it never costs the game a frame.

**What you have seen is the server's to decide and to keep.** The playable
world is split into 4 m squares, one bit each, which is 704 bytes per player
(`sim/exploring.ts`). Stepping into a new square marks everything within 36 m
as seen. The server works this out from its own positions, saves it with the
player (a new `explored` column) and sends it whole, at most once a second,
whenever it grows (the new `Explored` message). The browser also fills the map
in straight away from where it thinks you are, and merges the server's copy in
whenever it arrives, so the map never lags behind your feet.

**Unexplored ground is bare parchment.** `map/fog.ts` lays the page back over
everything not yet seen, with a soft, ragged edge like a wash not painted that
far yet. It is only worked out again when the explored map grows, in about
5 ms.

**Two ways to look at it.** The minimap sits top right. Whatever is ahead of
the camera is at the top, the same way the stash compass points, and a little
N on the rim shows which way the big map's top is. Your home and stash stay
pinned to the rim, pointing the way, when they are too far to show. The wheel
or its buttons zoom it, and clicking it opens the big map. The big map (M) is
a full journal page, north up, that you can drag and zoom, with labels, a
legend and how much of the woods you have explored. Walking carries on while
it is open. Escape puts it away before it would pause the game, and the
hotbar and hints step aside while it is up.

**The maps draw straight from the game, not through the HUD store.**
`MapFeed` is a plain object the game updates every frame with your position,
which way the camera is facing, other players nearby, your own builds and your
own stashes. The two map components redraw from it in their own animation
frames, so turning the camera never makes React redraw the whole HUD.

## Consequences

- A returning player gets their map back. A player saved before this starts
  with a blank page, the same as anybody new.
- Other players only show within the 100 m the server already tells each
  player about.
- The map shows the world as the seed made it. Felled trees still show until
  they come back, which is close enough for a map.
- The compass from decision 0049 stays: it is the quicker glance while walking.
- Changing the world's size or the square size starts everybody's map over,
  rather than reading one square as another.
