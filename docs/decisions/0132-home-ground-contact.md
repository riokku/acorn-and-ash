# 0132 · Home ground contact

## Context

Homes remain level on the gentle slopes where building is already allowed. Their flat footing, chimney bottom, entrance step and porch post caps could nevertheless hang above the downhill side. Refining shore terrain and fitting tree/rock bases did not address these separately built models.

## Decision

Keep the current cabin models and extend only their existing lower supports below sampled ground. Footings and chimneys stay level at the top; porch posts retain their top height. Entrance steps follow the ground at their own position. Stacked firewood rests on the local slope as a whole, and expedition-board post bases extend into the ground.

Each support retains its original vertices. Regrounding a placement preview restores those vertices first, so changing position or yaw never accumulates deformation. Apply the same grounding to previews and completed homes. Sample a small surrounding area as well as the support footprint to hide bottom caps despite small differences between analytic terrain and visible triangles. Extend the camera's existing home blocker down to the resulting base.

## Consequences

The server's build eligibility, level-ground limit, doorway rules and collision footprints are unchanged. This is a placement correction to existing geometry, not a replacement asset. Roofs, walls and openings remain upright. Splitting support and loose parts adds a few draw calls per cabin; grounding runs on placement changes, not on every frame at a stationary preview. Geometry and material ownership remain with the original model builders.
