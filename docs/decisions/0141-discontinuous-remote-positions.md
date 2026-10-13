# Remote relocation starts a new interpolation history

## Context

Remote actors always blended between their last two positions. Respawn-sized changes could therefore draw a character rapidly through hills and scenery. Old samples after a long absence also cannot show the route the actor took.

## Decision

Start fresh history after a gap beyond the retained 1.5-second history or a position change larger than three metres plus twice the reported three-dimensional travel over the sample interval. The tolerance preserves ordinary travel, falling, dodge attacks and modest corrections. Clear history only for that actor, and continue smoothing subsequent ordinary samples.

## Consequences

Relocation appears directly at the authoritative destination, with zero travel gait for the discontinuity, rather than as a very fast walk through terrain. This only changes rendering, not movement or server rules. Tests cover relocation, subsequent smoothing, high horizontal/vertical speeds and long gaps; a browser check observes the actual remote character positions across frames.
