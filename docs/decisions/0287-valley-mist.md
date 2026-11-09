# 0287. Mist on the water and in the hollows

**Status:** accepted · **Date:** 2026-11-09

## Context

Chris asked for the world to feel like the mountains of the Pacific Northwest.
After the far skyline (0286) he chose valley mist as the next piece. The fog
we have is one even haze that hides the distance; nothing lay low on the lake
at dawn or gathered in the forest's hollows.

## Decision

**Mist has places.** A list of spots is worked out once from the world's seed
and its ground (`apps/client/src/art/valley-mist.ts`): across the lake, along
the river, on the home pond, and in hollows, meaning level ground at least
1.5 m below the ground around it. The dry Sunreach plains and the ground above
the tree line get none. Everyone in a world finds mist in the same places.

**Mist has hours.** One number says how misty the world is:

- thickest at dawn, burned off by mid-morning;
- back at about half strength at dusk, and a little overnight;
- raised by drizzle and rain at any hour, thinned by a storm's wind, and gone
  in a blizzard;
- mistiest in autumn, least in summer.

Water mists first and clears last. Hollows only fill once the mist is thick.
Banks gather and thin over about nine seconds, so nothing pops.

**Drawn as soft banks near the camera.** Each bank is one wide, soft-edged
sheet turned to face the camera. At most 96 are drawn, within 105 m, from one
pool, with nothing made per frame. A bank thins out right in front of the
camera so walking into it never whites out the screen. It drifts slowly;
with reduced motion on it stays still.

**It is scenery only.** The server does not know about it. It does not change
what a player can see of creatures or other players beyond a soft veil, and
no hunger, warmth, combat or movement rule reads it.

## Consequences

- One more draw of at most 192 triangles. The sheets are see-through, so a
  camera low on the lake at dawn draws several over each other; the pool size
  and the reach keep that bounded.
- The art gallery's usual hour (`time=0.42`) has no mist, so existing gallery
  pictures are unchanged. `/?gallery=skyline&view=lakeside&time=0.27` shows
  dawn on the lake; `&mist=1` forces the thickest mist at any hour.
- Sunbeams through the trees were discussed alongside this and are left for a
  change of their own.
