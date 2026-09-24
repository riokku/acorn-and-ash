# 0030. Real pine and rocks, from packs with no glTF export

**Status:** accepted · **Date:** 2026-09-24

## Context

Decision 0029 left pine, the boulder and the mossy rock drawing their
placeholder shapes - the pack used for birch and oak had no real geometry for
them. Chris asked for two more Quaternius CC0 packs to fill the gap:
**Simple Nature Pack** (rocks) and **Stylized Tree Pack** (pine). Both were
recommended and downloaded on the strength of their preview images alone,
without checking what export formats they actually ship - unlike Ultimate
Stylized Nature, neither offers a glTF download at all, only **FBX, OBJ and
Blend**. That mismatch cost a round trip with Chris re-downloading the wrong
folders before it was caught.

OBJ was the practical choice of the three: it converts to glTF with a plain
Node package (`obj2gltf`), unlike FBX (needs a compiled converter or Blender)
or Blend (needs Blender outright, which nobody involved can run). Inspecting
the actual files turned up one more wrinkle: the Stylized Tree Pack's `.obj`
files have correct UV coordinates and a `Textures/` folder with the right
images, but their `.mtl` files never got a `map_Kd` line pointing at them -
every material read back as the same flat mid-grey. The Simple Nature Pack
has no such gap; its rocks are genuinely meant to be flat-shaded, with no
`Textures/` folder shipped at all.

## Decision

**Teach the existing import script a second input format instead of writing
a new one.** `tools/import-model.mjs` now takes `.obj` as well as `.gltf`:
for OBJ input it converts through `obj2gltf` first (in memory, no
intermediate file), then joins the same optimize-and-compress pipeline
either input already went through. One tool, one call per asset, regardless
of which format a pack happens to ship.

**Fix the missing texture links by hand, once, per material.** Before
conversion, each affected `.mtl` got a `map_Kd` line added back for its
`Bark` and `Pine_Leaves` materials, pointing at the pack's own
`Tree_Bark.jpg` / `Pine_Leaves.png`, matched by reading the material and
texture names rather than guessed. The rock pack needed no such fix - its
flat grey is the intended look, not a dropped reference.

**One variant each, same as birch and oak.** `Pine_1` (664 triangles) became
the `pine` kind. `Rock1` became `boulder`, `Rock2` became `mossyRock` -
different meshes for the two, so they read as separate rocks rather than one
model at two scales, even though neither pack has an actual moss texture to
back up the "mossy" name.

**Generalized the loading module instead of duplicating it.**
`scene/tree-models.ts` was already structured as a generic
`PropKindId -> model URL` map; rocks needed the exact same
preload/scale/fall-back-to-placeholder mechanism trees already had, not a
parallel copy of it. Renamed to `scene/prop-models.ts`, and
`createPropMeshes`'s rock branch now checks it first, mirroring the tree
branch exactly.

## Consequences

- `tools/import-model.mjs` depends on `obj2gltf` now, in addition to the
  gltf-transform stack. Any future OBJ-only pack reuses it as-is.
- Both packs also include bushes, grass, a generic tree, a dead tree and a
  dead birch - none of that was asked for or is wired in. Left alone; adding
  any of it later is a data-table row plus one more import call, not new
  plumbing.
- The mossy rock still isn't actually mossy - it is a second plain rock
  mesh, not a mossy-textured one. Real moss means a different source, same
  as pine did before this pass.
- Every future OBJ pull from a Blender-sourced pack should expect the same
  missing-`map_Kd` check; this one happened to need it, the other did not,
  and there was no way to tell without opening the `.mtl` files.
- Playwright hung repeatedly trying to hold a movement key and screenshot a
  live session in this sandbox tonight, for reasons unrelated to this
  change (the same script's first screenshot worked fine). Verified the
  converted models structurally instead - correct triangle counts, correct
  embedded textures at sensible resolutions - and the loading path itself is
  unchanged from 0029's already-proven birch/oak code. Worth a quick look on
  the PR's preview link rather than taking that as equivalent to seeing it
  run.
