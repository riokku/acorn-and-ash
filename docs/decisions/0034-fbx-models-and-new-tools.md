# 0034. FBX models, and a real axe and fishing rod

**Status:** accepted · **Date:** 2026-09-25

## Context

Chris sent three downloaded packs to pull more real art from: a farm/wild
animal pack, a survival-gear pack, and a fishing pack - all `.fbx`, except
the animal pack which also had a `.gltf` export. Everything so far
(0029, 0030) had only ever come in as glTF, so this was the first time the
pipeline needed to read FBX at all.

Chris only knew "I believe these are all from Quaternius," not which pack
page each one was. Guessing a plausible-looking URL was not an option, so
each pack's source was either independently confirmed by searching
Quaternius's own site and matching item counts against what was actually in
the download, or confirmed by Chris directly when the search came up short.
That worked for the animal pack (exact match: twelve animals, the same
animation set) and, once Chris sent the direct links, for the survival pack
and the fishing pack too.

Converting the fishing pack's rod started before its source was confirmed
and had to be unwound - model, code and `LICENSES.csv` row all removed -
once it became clear the citation wasn't solid yet, then redone once Chris's
link confirmed it. Costly to redo, but cheaper than shipping an asset this
project can't actually attribute; `LICENSES.csv` exists precisely so nothing
gets in without a defensible answer to "where did this come from."

## Decision

**Blender converts FBX the same way it already converts OBJ**: import with
`bpy.ops.import_scene.fbx`, then hand off to the existing
`tools/import-model.mjs` for Meshopt compression - exported as `.gltf`
(not `.glb`) specifically because that script only reads `.gltf`/`.obj`
input. No new compression tooling, just a new front door into the same
pipeline.

**Every material from this pack's FBX files imports with Alpha at 0**, even
though `blend_method` still reads `OPAQUE`. EEVEE ignores that and renders
fine; Cycles (what these conversions render preview frames with) honors the
actual Alpha value and draws nothing at all. Geometry, camera and lighting
all check out, which made this a slow diagnosis. The fix is one line per
material, right after FBX import: force `Alpha` back to `1.0`. Documented
here so the next FBX pull from this pack does not repeat the same hour of
debugging a blank render.

**Axe and fishing rod replace their placeholder shapes**, the same
drop-in-real-geometry pattern 0029 set for trees: `item-models.ts` loads
both up front, and `clearing.ts` draws the real model when it's loaded and
the placeholder shape otherwise.

**Wooden torch, shovel and a recolored goldfish are converted and licensed,
but not drawn anywhere yet.** Neither the torch nor the shovel has a
mechanic to attach to - no lantern-carrying, no digging tool distinct from
bare hands. The goldfish stands in for a "golden carp" catch, but no fish,
caught or otherwise, has any 3D presence in this game at all yet (the HUD
lists carried items as plain text). Shipping them now means the next
mechanic that needs one only has to wire it up, not source and convert it
first.

## Consequences

- Whoever builds a torch/lantern mechanic or a digging mechanic starts with
  real art already in `assets/items/`, already in `LICENSES.csv`.
- The golden carp specifically still needs somewhere to be drawn at all -
  that's a fish-rendering gap bigger than this one asset, not something
  this change fixes.
- Any future pull from either FBX pack should expect the same Alpha-zero
  import behavior and apply the same one-line fix.
