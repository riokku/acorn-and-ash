# 0053. Painted textures and real shapes, drawn in code

**Status:** accepted · **Date:** 2026-09-27

## Context

Chris asked for every missing texture in the game to be made, "extremely high
quality while being performant", in the cozy outdoors feel. Nothing was
actually broken: the trees, flowers and characters had their textures. But
the ground, the pond, every buildable, the rabbit, the raccoon and the small
props were single flat colours, most of them on placeholder shapes. Asked
directly, he chose:

- all four groups (ground and pond, buildables, creatures, small items);
- a soft painted look matching the Quaternius trees;
- better shapes as well as textures;
- textures drawn by code rather than image files or an online library;
- a target of 60 fps on an everyday laptop with no gaming graphics.

## Decision

**Textures are painted in code while the world loads.** `art/recipes.ts`
paints twelve of them, seeded so every browser gets the same picture: grass,
forest floor, bark, planed wood, a log end, stone, cobbles, roof shingles,
soil, burlap, fur, and pond ripples. Each starts from a soft cloudy base and
adds brush strokes and dabs on top: grass blades in tufts, wood grain around
knots, fallen leaves, lichen. All but the log end tile seamlessly, and a test
checks for seams in both directions. Together they take about half a second
to paint, a texture at a time so the loading screen keeps moving, and use
about 9 MB of graphics memory.

**Materials are shared.** `paintedMaterial` hands out one material per
texture and tint, so fifty fence pieces share two. Each model's parts are
merged into one mesh per material (`ModelBuilder`), so a cabin of forty logs
draws in about a dozen calls. Every texture is laid on at real-world size, so
a plank's grain and a log's bark are the same scale however long they are.

**The ground and the pond get small shaders of their own.** Each corner of
the ground mesh stores how bare it is and a soft tint, worked out once from
the world (`ground-shading.ts`). Earth shows under trees, on steep slopes and
where everyone arrives. Grass stays lush by the water, and big sunny and
shady patches sweep across the wilderness. The shader blends grass into
forest floor with a ragged edge, and blends a second, rotated copy of each
texture in winding patches so the repeat never lines up. The pond darkens
towards its middle, catches the light on two drifting layers of ripples,
laps pale at the edge, and its muddy bank fades into the grass. Each pixel
costs at most four texture reads.

**Placeholder shapes become real models, built in code** from logs, planks
and stones with textures already on them. That covers:

- a log cabin with notched corners, a stone footing, a plank door and
  doorstep, a glowing window with a flower box, a shingled roof with board
  gables, a fieldstone chimney and a woodpile;
- a split-rail fence, whose posts sit exactly where pieces snap together;
- a garden lantern on a post, a planter-box flower bed, and fieldstone path
  stones;
- a buried mound marked with an X of sticks;
- a burlap sack, a pile of forked sticks, and a stump with root flares and
  rings;
- lily pads (some in flower), cattails and edge stones round the pond;
- the rabbit and the masked raccoon.

A test holds each one to its triangle budget in the data tables.

**Pack models are touched up where they fell short.** The pine's leaf texture
was exported without saying its gaps are see-through, so they drew black; all
leaves are now crisp cut-outs, which also stops the birch and oak flickering
where they overlap. The two rocks had no texture at all and now get painted
stone (the mossy one gets its moss). The campfire's flat-coloured logs,
stones and ash get bark, stone and ash. The fox was turned the wrong way
round and trotted about tail first; it now faces the way it moves.

**A gallery page shows it all:** `?gallery` in the address lays every piece
out in daylight, with no server. It's for checking the art and for playtesting
the look.

## Consequences

- Loading takes about half a second longer, spent painting.
- None of this art is a file under `assets/`, so it needs no licence rows. It
  is all the game's own.
- The hotbar and menu icons are still simple shapes drawn in the HUD, and the
  characters, trees, flowers, fox and tools keep their pack art.
- A garden path stone and a fence piece still get their shape and turn at
  random each time they're drawn, so two players see slightly different
  stones. This was already true of the path stone and costs nothing that
  matters. It would need the piece's id to fix.
