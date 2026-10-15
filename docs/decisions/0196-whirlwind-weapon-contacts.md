# 0196 — Whirlwind contacts follow the weapon

## Context

The charged attack looked circular but checked creatures once at a single tick;
tool work still selected only one tree in front, and hitting a creature prevented
that tree contact. Moving could bring new targets into reach after that check.
Chris wants everything within the whirlwind to be hit as the axe sweeps past.

## Decision

Use the same eased two-turn phase for animation and shared simulation. Each
active input tick checks the angular interval swept by the extended weapon since
the previous tick, including the body's change in facing. Cover the entire arc
so fast turns cannot skip targets between ticks. Keep normal melee reach, trunk
surface reach, vertical limits and modest contact width.

Track contacted creatures and trees separately for each attack. Both turns can
hit new targets, including while moving, but never award damage or wood twice
for one target. Axes contact every eligible trunk, even when a creature is also
hit. Torch contacts keep the existing seasonal ignition rules; a shovel still
makes only one deliberate dig. Light swings and aerial dodge slams stay directed.
Skeleton whirlwinds use the same sweep and retain their delayed settlement and
dodge rules. Existing combat eligibility remains.

Store each contact's position and facing with its input, on server and client,
so several inputs processed in one frame do not all hit from the last position.
Prediction replays movement without replaying contact effects. Creature history
allowance covers latency, not the entire time since charging began.

## Consequences

No network action id, snapshot field, model or animation asset changes. Tests
cover all 360 degrees, weapon order, late contacts while moving, yaw wrap and
reverse turns, height/range, once-per-attack damage and tree/creature contacts
together. A fresh attack may contact the same targets again.
