# 0129 — Standing foot contact on terrain

## Context

Characters stand at the ground height under their center, but their authored idle pose assumes a flat floor. On a hillside that leaves the uphill foot buried and the downhill foot floating.

## Decision

After animation and body placement, sample collision ground at each ankle and use the existing two-bone reach solver to bend each leg towards its local floor. Lower the pelvis by at most 12 cm to support the downhill foot; reject ankle height changes greater than 18 cm so cliffs and dug openings do not stretch the rig. Smooth height adjustments and limit sole tilt to 30 degrees.

Keep the authored flat-floor ankle clearance. Corrections operate in world metres despite the model's scale and orientation, and restore the original bone transforms before every animation update to prevent accumulation. Use only the standing idle leg share, fading with the gait blend through starts/stops and yielding to whole-body gestures and fishing. Walking, airborne actions, rolls, seated poses and unavailable rigs keep their existing presentation.

Pass the active collision ground to both local and remote characters, including indoor rooms and dug floors. The character's outer position, camera target and server simulation do not change.

## Consequences

Standing characters adapt to moderate slopes with small knee/pelvis adjustments. Extreme ledges retain the authored pose. This pass does not add full walking foot placement; high-visibility mismatches between terrain rendering and physical ground remain a separate polish pass.
