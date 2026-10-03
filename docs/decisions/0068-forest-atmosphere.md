# 0068 — Quiet evergreen forest atmosphere

## Context

Walking was silent, and the forest needed a quiet Pacific Northwest mood:
damp ground, occasional nearby birds and restrained foliage movement. Tree
replacements should be recommended first, before changing the current art.

## Decision

A local cosmetic controller measures distance actually travelled for footsteps,
with distinct grass, forest litter, worn soil and indoor wood sounds. It uses
the same ground classifier as the painted terrain, including real hillside
slope. Airborne movement is silent until landing; stationary movement intent,
teleports, pauses and background frames cannot replay queued footsteps.

Bird phrases and soft canopy swells originate at actual nearby standing trees,
with distance attenuation and camera-relative stereo. Daytime birds leave long
gaps and stop at night. Walking close to a tree occasionally adds a brush of
foliage. Felled trees leave the sound-source lookup; regrowth restores them.
All scheduling uses the existing frame loop, with no server changes or timers.

Short synthesized sounds follow the existing audio approach, require no new
licensed recordings and use a bounded, disposable audio bus. The SFX slider
changes existing ambience immediately; pausing or hiding the game stops it.
Birds are stylized woodland phrases, not species-authentic recordings.

## Consequences

The ambience is local to each listener and cannot affect gameplay. This first
pass covers existing surfaces; future explicit terrain materials can extend
its surface sampler. Tree recommendations live in the art direction document;
no models or elevation are replaced in this pass. Browser listening is needed
to judge the balance against music and action sounds.
