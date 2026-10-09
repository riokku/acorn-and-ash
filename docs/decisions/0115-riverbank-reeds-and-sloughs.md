# 0115 · Riverbank reeds and visual sloughs

## Context

Chris asked for the lake's reeds along the riverbanks too, and for sloughs with lily pads that are visual for now.

## Decision

- Reuse the existing green reed and cattail clumps on both riverbanks, in loose groups with bare gaps. Skip steep falls and places where the terrain would bury the plants.
- Place six small, irregular still-water pools along the middle and lower river bends, spread across both banks. Each has an open, water-filled neck joining the main river. Reuse the lake's water, shore plants, lily pads and flowers, keeping the river openings clear of shore stones and plants.
- Shape shallow floors and gentle banks using shared terrain data so the water is visible and client and server agree on ground height. Keep trees, rocks, buildings and spawns out of the pools using the existing water clearance system.
- Give each mouth a broad opening, about eight metres wide. Both water materials treat the join as continuous water, suppressing the pale shoreline across the opening while preserving it along the remaining banks.
- Blend the river into the slough's colours and ripples over two metres near each mouth. Both surfaces use the same water colouring there so no abrupt blue seam remains.
- Sloughs and lily pads are scenery only: no harvesting, fishing, swimming, boating or seasonal ice behavior is added. Riverbank scenery reeds do not add mature gatherable beds.

## Consequences

The river has the same plant vocabulary as the lake, and quiet pools provide places for lily pads away from the current. Plant geometry shares materials and is merged into a few meshes. Existing gatherable reed beds, their saved IDs and regrowth timers stay as they were.
