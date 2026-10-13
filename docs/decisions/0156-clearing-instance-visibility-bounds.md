# 0156 — Refresh clearing instance visibility bounds

## Context

The clearing reserves hidden stump instances at the origin. Three.js caches a mesh's visibility bounds when rendering; uploading new instance matrices does not refresh those bounds. A freshly felled stump could disappear when its camera view excluded the old bound. Changing regrowth size has the same requirement for standing trees. Wilderness stumps already recompute their bounds when repacked.

## Decision

Invalidate the clearing meshes' cached bounding sphere and box whenever tree states place, hide or regrow their instances. Three.js then computes the current bounds on demand. Keep normal frustum culling and existing rendering, chopping and collision behaviour.

## Consequences

Felled clearing stumps remain visible across camera angles and later state changes. Bounds are refreshed only for affected mesh batches. A regression test caches hidden stump bounds, then checks eight camera directions through multiple felled trees and regrowth; it fails before this fix.
