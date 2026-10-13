# 0158 — Spring outlet and changing channel width

## Context

The spring's shore connection sampled only the first six metres of river, while its downstream lobes reached beyond ten metres. This left a pale shoreline rim across the flowing outlet. Independently offset banks still left the river's total width looking too consistent.

## Decision

Build the spring's connection mask through its furthest downstream basin centre and six additional sampled rows. Both water materials share this mask, removing a false shore at the outlet while retaining the existing colour and ripple transition. Other slough connections stay unchanged.

Add smooth broad/narrow reaches to the shared side-specific channel widths. Their conservative placement extent, existing source and lake-mouth widths, valley profile and water levels remain unchanged. Terrain, rendering, wading, boat shoreline and current already consume these shared widths.

## Consequences

The spring no longer has a shoreline rim where its outlet is open water. The channel alternates broad and narrow stretches smoothly without widening into existing prop placement. Regression checks cover the outlet mask and width amplitude, continuity and bounds.
