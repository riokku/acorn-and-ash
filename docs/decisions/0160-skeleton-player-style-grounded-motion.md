# 0160 — Player-style grounded skeleton motion

## Context

Skeleton rigs already use the player animation library and its attack/dodge/gait blending. Their snapshot driver still animated from reported speed while an entity's displayed location was held, and omitted the player's terrain-footing callback. This could produce walking in place and poorly seated feet on slopes.

## Decision

Feed skeleton locomotion from interpolated visible travel, as remote players do. Supply the same collision-ground callback to the shared character controller so skeleton feet use its existing reversible terrain correction. Keep authoritative action ages, combat timing, dodge direction, effects, and shared clips. Add a slope parameter to the existing raider gallery for inspecting real rigs.

## Consequences

Walking stops naturally when visible travel stops, while attacks and dodges keep advancing. Grounded skeletons adapt to the walking surface without changing their server position. No new clips, rigs or art assets are introduced. A snapshot-driven crowd regression covers motion, held location, grounding and continued dodge action.
