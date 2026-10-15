# 0194 — Keep the canoe paddle in the rider's hands

## Context

The canoe moved its paddle independently while the rider played an idle sitting
clip, so the shaft floated beside resting hands. It was especially visible while
turning or coasting.

## Decision

Reuse the existing paddle geometry, parented to the character's right hand slot.
After the sitting clip and seat placement, solve both arms toward the shaft and
its upper handle. Keep a fixed 43 cm span between the grips and preserve the
paddle's physical size under the character's scale. The blade turns with the
rider, then feathers during recovery. Restore the original bone transforms before
each new animation sample so procedural corrections cannot accumulate or leak
into walking, combat or fishing.

Drive one continuous stroke clock from paddling effort, excluding river-current
movement, for both local and remote players. Smooth effort changes into a raised
coasting grip; integrate that smoothing analytically so frame rate does not change
the stroke. Boarding uses the existing seat blend. Landing hides the held paddle
and reveals the stowed one on the empty canoe.

## Consequences

This is a client animation change using the existing rig, paddle and materials.
No new model, animation asset, protocol field, control or navigation rule is needed.
Tests exercise the shipped rigs for all six bodies, both hand contacts, rigid grip
spacing, blade recovery, turning, frame-rate consistency and the full character
update/landing path. The canoe gallery supports frozen stroke poses, `&coast`
and `&body=<character>` for inspection.
