# 0216 — Prepare transient effects before play

Fire and tree-landing effects were pooled but hidden during loading, so their first actual render still needed shader/pipeline and GPU-buffer preparation. Campfires also created and destroyed their animated flame on every ignition/extinction. Falling trees invalidated batch bounds every frame, and settling one tree marked every forest transform dirty.

Render transient effect pools once behind the initial loading curtain, in the live scene with its existing light configuration. Restore visibility, counts and culling afterward, then draw the normal scene before revealing it. This avoids a separate asynchronous compilation overlapping the render loop. Campfires retain a hidden flame instance between burns.

Use an envelope covering each tree's complete rotation to extend batch bounds without rescanning all instances during the fall. Regeneration marks only the changed tree's transform dirty; LOD moves and shifted batch slots still upload as needed. Bounds may be temporarily conservative until the next normal batch rebuild.

This shifts first-use preparation into loading and avoids repeated CPU/GPU work. Device-specific frame times still depend on scene complexity and rendering hardware; regression checks cover resource reuse, state restoration, bounds coverage and unchanged distant buffers rather than fragile timing thresholds.
