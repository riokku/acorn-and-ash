# 0066 — Tree landing effects and clear pickup refusals

## Context

A falling tree needed a convincing ground-contact moment. Full packs already
had a quiet hint, but an attempted pickup could fail silently or fall through
to another E action, such as eating equipped food.

## Decision

Crossing the fall's ground-contact time emits one local landing event. It
triggers soft billowing dust along the trunk, bark fragments, a short settling
rebound and a layered thump. Sound and a restrained camera impulse fall off
with distance. Reduced-motion preferences suppress the camera impulse. Late
joins and background tabs do not replay old impacts; no new server timers run.

Dust uses a procedural texture and a fixed pool of 128 instanced billboards,
with per-particle opacity and one draw call only while active. Existing bark
bursts are reused. The synthesized impact and refusal sounds require no new
external assets, honor the SFX slider and release their audio nodes afterward.

The server sends a private pickup-refusal message for tools, dropped items and
resource patches. A full pack leaves the target intact and claims E instead
of falling through to food or a fire. Partial pickups keep what fits and report
the remainder. Duplicate tools get a separate explanation. A held E reports
once; releasing it permits another attempt. The client shows one accessible,
brief notice with an Open pack button and limits sound on rapid retries.

## Consequences

The ground-contact effect is cosmetic and cannot damage or block anything.
Inventory feedback follows the actual server result, including multiplayer
races. Players must step away from a blocked gather target to eat using E.
The new feedback message requires the matching client and server deployment.
