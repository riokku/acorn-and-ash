# 0029. The first real art pass: birch and oak

**Status:** accepted · **Date:** 2026-09-24

## Context

Every tree, rock and creature has been a placeholder shape since Phase 0, by
design: build the mechanic first, replace the shape once it is fun. With
Phase 4 done, Chris asked what to work on next and chose to start improving
the art for what already exists rather than push straight through the
remaining phases. Trees and rocks went first, over the player, tools or
creatures: the game's art style already names a specific free pack
(Quaternius's CC0 "Ultimate Stylized Nature"), so there was no new sourcing
decision to make, and unlike a character or a creature, a tree is a static
shape with no animation to rig - the simplest way to prove out a real asset
pipeline before touching anything that moves.

Chris downloaded the pack himself and sent over its `glTF` export folder. It
turned out to only contain real geometry for **birch**, **maple** and **dead**
trees; **pine**, the pack's generic "normal" tree, **palm**, and **rocks**
have textures sitting in that folder but no matching mesh - they exist
somewhere in the pack's other formats or its master Blender file, neither of
which was worth chasing down for a first pass (this pipeline has no Blender
available to open the latter, and the former would very likely turn out to
have the same gap, since every format is exported from the same source).

## Decision

**Use what the pack actually has.** Birch becomes the game's birch. The pack
has no oak, so maple stands in for it - the closest broad, round-canopy
shape available. Pine and the two rock kinds keep drawing their placeholder
shape until we source them from somewhere else.

**One shared copy per model, tracked as an asset, not duplicated into the
client.** Each model is processed once by `tools/import-model.mjs` (built on
`@gltf-transform/core`) and written to `assets/trees/*.glb`, alongside its
row in `assets/LICENSES.csv`. The client reaches it through a `@assets` Vite
alias rather than a copy living under `apps/client`, so there is exactly one
file to update if it ever changes.

**No normal maps.** The pack's normal-map textures are enormous (18-22 MB
each, for a single tree species) and add detail lighting a flat-shaded,
stylized-low-poly look has no use for. We only ever pull the base color
textures, so every model's normal-texture reference points at a file that
was never brought in; `import-model.mjs` strips that reference and prunes
the orphaned slot rather than shipping a broken link. Anything pulled from
this pack later will need the same treatment.

**Sized to the game's numbers, not the pack's.** Each tree kind already has
a designed height in `packages/shared/src/data/props.ts`
(`trunkHeight + canopyHeight`), used until now to size a placeholder
cylinder and cone. The import script measures the real model's own height,
scales it uniformly to match that same number, and shifts it so its base
sits exactly at ground level - so it drops into the existing per-instance
placement code (position, yaw, one scale factor) with no special-casing, the
same as every placeholder prop already does. The model's width follows from
that scale rather than being forced to match the placeholder's old
`canopyRadius`, which was only ever a guess to begin with.

**Loaded once, up front.** `scene/tree-models.ts` fetches both models as
soon as the game starts, in parallel with connecting to the server, and a
world is never built before that finishes. `createPropMeshes` asks it for
each tree kind's real parts first and only falls back to the placeholder
shape when there isn't one (pine, or a species we haven't sourced yet) - so
the instancing code that draws a hundred and fifty trees in a handful of
draw calls did not need to change, just gained a second source of geometry.

## Consequences

- Pine, the boulder and the mossy rock still draw their placeholder shape.
  Getting real art for them means sourcing it separately - either digging
  further into this same pack's other formats, or a different pack
  entirely.
- The data table's `oak` key now draws a maple. Nothing about that shows up
  to a player, but the next person searching this pack for a literal oak
  model won't find one.
- Every future model pulled from Ultimate Stylized Nature will hit the same
  missing-normal-map gap; `tools/import-model.mjs` already handles it
  generically, so future imports are just another call to the same script.
- A tree's on-screen width now comes from its real proportions rather than
  a hand-picked placeholder radius, so canopies may read a little
  narrower or wider than before at the same height.
