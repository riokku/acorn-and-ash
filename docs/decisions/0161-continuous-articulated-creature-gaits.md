# 0161 — Continuous articulated creature gaits

## Context

Elk, curious raccoons and woodland guardians animated their articulated limbs, but abruptly changed stride amplitude above 3m/s. Absolute-value body bounce and knee bend introduced sharp velocity changes at step boundaries. Advancing gait with the already-eased end-of-frame speed made startup cadence depend on frame rate.

## Decision

Blend stride amplitude continuously across walk/run speeds. Use smooth squared step curves for torso bounce and knee flexion. Integrate the existing exponentially eased speed exactly for gait distance, retaining its response time, idle motion and action envelopes. The gallery accepts a bounded `at` time for repeatable motion screenshots.

## Consequences

Existing models gain softer contacts and continuous walk/run transitions without new rigs or clips. Server behaviour, travel speed, combat timing and visual style remain unchanged. Real articulated poses are compared at 30, 60 and 144 FPS; regressions check continuity across the previous speed threshold.
