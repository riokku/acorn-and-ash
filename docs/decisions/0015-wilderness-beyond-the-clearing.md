# 0015. Wilderness beyond the clearing

**Status:** accepted · **Date:** 2026-09-22

## Context

The settled design says the world is "a hand-built home clearing surrounded by
wilderness generated from a seed." Until now it was only the first half: walk
past the clearing's own ring of trees and you hit an invisible wall a few
metres later, because Phase 0 had nowhere else for you to go. With fishing
done, Chris asked to open that up next, ahead of adding more to gather.

## Decision

**The wilderness is seeded, like the clearing.** `buildWilderness(seed,
terrain)` runs on the server and in every browser and reaches the same answer,
so nothing about the shape of the forest or the ground travels over the wire.

**Ground stays flat through the clearing and its own tree line, rolls into
hills beyond that, and flattens again before the wall at the edge of the
world.** Height comes from a small deterministic noise module
(`world/noise.ts`): no dependency, no `Math.random()`, just a hash of
`(seed, x, z)` blended across a lattice. Flat at both ends means neither the
clearing nor the boundary ever sits on a slope.

**Trees and rocks scatter in patches, not evenly.** A grid of candidate spots
is jittered so it doesn't read as a grid, then a second, coarser noise field
decides forest from glade, so the wilderness has a shape rather than being
wallpaper. Density also eases in over the same stretch the ground eases into
hills, so the tree line thickens gradually rather than starting at full
density the moment the clearing's own ring ends.

**Nothing out there is chopped, picked up, or ever changes.** This is
scenery and collision only. Chris asked for the world to open up, not for a
new thing to gather - that stays a smaller, separate change - so wilderness
props never need an id anybody chops, saves, or sends a message about.

**The wall moved from 38 m to 150 m out.** Still a bounded, finite world, not
infinite or streamed terrain - that is a bigger change (real chunk streaming)
for later, the same way the old wall was already a placeholder for this one.

## Consequences

- For the default seed, the wilderness scatters 1,358 trees and rocks
  (previously the clearing alone had 166). All of it lands in the same flat
  collider array the clearing's own props already used, which is still fine at
  this size: benchmarked at 50 simulated players, the worst tick measured
  2.42 ms against a 10 ms budget, using about 19 MB of the Durable Object's
  128 MB. A much bigger wilderness, or many more players, would want a spatial
  index instead of a flat scan - see decision 0003.
- The client draws one ground mesh for the whole visible world - flat
  clearing, rolling wilderness, flat horizon filler - instead of a separate
  flat plane per area, so there is nothing for two grounds to z-fight over.
  `apps/client/src/scene/clearing.ts` no longer builds any ground at all.
- The instancing and camera-blocker code that used to live only in
  `clearing.ts` moved to a shared `scene/props.ts`, so the wilderness scene
  reuses it rather than duplicating it. The camera's "is something in the way"
  check now looks at two blocker meshes: the clearing's, rebuilt on a chop or
  regrowth exactly as before, and the wilderness's, built once and never
  touched again, because nothing out there changes.
- `PlacedProp` gained an optional `y`: absent (so zero) everywhere in the
  clearing, set from the terrain for wilderness props, so a tree on a
  hillside sits on the slope instead of floating or sinking into it.
- `PLAYABLE_HALF_EXTENT` now means the edge of the generated wilderness
  rather than "the edge of the Phase 0 test clearing." The clearing's own
  ring of trees no longer depends on that constant - it has its own
  `CLEARING_TREE_LINE_INNER`/`OUTER` - so growing the wilderness further
  later is a one-constant change that cannot also reshape the clearing.
