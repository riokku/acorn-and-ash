# 0155 — World-space summer pollen

## Context

Summer pollen was recycled inside a 28 m square in front of the camera, at full size right up to its edges. Turning or walking exposed the moving boundary. Pollen also sampled the ground every frame, making airborne grains follow slopes; changing wind multiplied the full elapsed time and could relocate particles.

## Decision

Use a fixed 520-instance pollen pool across 64 m, retaining approximately the original local density. Fade across the outer 12 m before recycling. Each grain keeps its world height relative to its spawn terrain until recycled, with only its existing airborne bobbing. Integrate wind displacement using elapsed frame time for seasonal particles. The existing trees gallery shows seasonal particles when a season is requested, using the same camera-centre placement as the game.

## Consequences

Camera turns and walking reveal overlapping world-space pollen rather than a small following patch. Work and memory remain bounded; the pollen pass now updates 520 tiny instances instead of 100, in one draw call. Indoor, night, blizzard and reduced-motion suppression are preserved. Petals, leaves and snow retain their existing pool sizes and falling behaviour.
