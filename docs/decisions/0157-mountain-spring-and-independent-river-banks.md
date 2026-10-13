# 0157 — Mountain spring and independent river banks

## Context

The river started as a narrow ribbon against the mountain, without a readable spring. Its opposite banks shared one gradually increasing width, making the channel look consistently symmetrical.

## Decision

Add a connected, shallow headwater basin at the existing river origin, formed from overlapping lobes and framed with the existing painted rocks. Its water follows the source grade and blends into the river. Reuse connected-basin handling for terrain support, depths, boat surface height, prop/build exclusion, water reactions, shore refinement, map painting and winter ice. The mountain pool has reeds and stones but no lily pads.

Each channel side uses its own smooth, deterministic width variation, within the previous conservative placement extent. Rendering, terrain, wading depth, current, hull shoreline, reeds and sand shading use the same side-specific width. Variation eases out at the source and lake mouth; the broader valley and waterfall profile remain unchanged. Existing galleries expose the spring and banks, including a frozen preview.

## Consequences

The river gains a supported source and uneven shores without new model or texture assets. Shallow/deep movement follows the visible channel; winter freezing covers the spring. Shared rules remain deterministic across server and browser. The stream's immutable basin list is cached to avoid allocations in repeated terrain queries. Existing saved worlds pick up the new terrain and shoreline layout on load.
