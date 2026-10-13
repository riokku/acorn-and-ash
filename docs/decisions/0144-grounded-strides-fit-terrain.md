# Grounded strides retain terrain contact

## Context

The existing restrained foot solver corrected only the idle gait. Once walking or running took over, the feet returned to a flat-floor pose, bringing back hillside penetration or floating. A moving ankle could also cross the solver's reach limit and switch its correction off abruptly.

## Decision

Use the share of grounded gait legs for terrain fitting, including legs that remain free beneath a walking attack. Keep each clip's authored foot lift: shift the current animated ankle by the ground difference under it instead of pinning it to the floor. Fade terrain corrections as ankle-height differences approach the existing 18-centimetre limit.

## Consequences

Gentle slopes fit grounded strides with the same bounded knee/pelvis and sole adjustments as standing. Flat-floor strides remain unchanged. Airborne, rolling, seated and whole-body fishing/gesture poses keep their own footing; there is no world-space foot locking or change to character collision and speed. Tests cover lift preservation, flat poses, blend ownership and reach-limit transitions. Actual rig checks compare three walking phases on all six bodies, retaining authored lift within 2 cm on the controlled hillside.
