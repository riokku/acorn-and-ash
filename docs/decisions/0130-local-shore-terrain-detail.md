# 0130 — Local terrain detail at water contacts

## Context

Most ground uses 2.5 m squares. Movement, scenery placement and standing foot contact use the analytic height field, while the camera sees those broad ground triangles. Auditing seed 734 found differences up to 41 cm near the lake, 92 cm near island edges, 1.29 m near sloughs and 46 cm along the river.

## Decision

Extend the waterfall ground-patch mechanism to curved lake/island shores, sloughs and river banks. Compare each candidate cell's broad triangles with physical height samples. Cells missing by over 4 cm receive local detail, with 4, 8 or 16 divisions depending on curvature and a neighbouring-cell buffer. Flat candidates and the rest of the world keep their original resolution.

Reuse boundary vertices where possible. Finer boundary points interpolate the coarser neighbour's edge samples, so different levels meet without cracks. Keep the original digging-cell keys, return lattices from the refined triangles and remove every triangle belonging to a hidden cell. The camera continues using that same visible ground with indirect BVH traversal.

## Consequences

The sampled seed-734 maximum differences fall to approximately 1 cm at the lake, 5 cm on islands, 6 cm near sloughs and 3 cm along the river. Geometry and one-time scene construction cost increase locally: that world has about 476,000 ground vertices versus 169,000 previously. Regression checks keep two sampled worlds below 600,000 vertices and shoreline height errors below 10 cm, while checking patch joins and digging compatibility. No simulation, terrain height functions, water rules or assets change. Cabin entrances and other land contacts remain separate polish work.
