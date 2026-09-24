# 0032. Sound effects and background music

**Status:** accepted · **Date:** 2026-09-24

## Context

Decision 0031 added a camera kick to chopping, fighting, and taking damage, and named sound as the obvious next "feel and juice" piece. Chris asked for both action sound effects and calm, continuous background music, and this time sent the actual files rather than having me source and describe packs for him to go find - two CC0 packs: Kenney's Impact Sounds, and one quarter of Abstraction / Tallbeard Studios' Music Loop Bundle (10 tracks).

Picking the right music track was its own problem. The bundle's ten tracks (all filed under one generic "Electronic" genre tag, so that told me nothing) are named for mood - "Seaside CORAL REEF", "Vacation Day CHILLOUT", "Dark Portents MYSTERIOUS TRAVELER", and so on - but I have no way to listen to audio directly. Titles alone are a weak signal: a name can be misleading, and "calm" is exactly the kind of judgment call that's supposed to rest on how a thing actually sounds.

## Decision

**Measured loudness and dynamics stood in for listening.** Ran `ffmpeg`'s `volumedetect`/`astats` filters over all ten tracks and compared mean volume, peak volume, and crest factor (how much a track's peaks exceed its average - a rough proxy for how punchy/percussive versus smooth/sustained something is). The two "Seaside" tracks were clear outliers on every axis: the lowest crest factor of the batch and the only two with a peak more than 2 dB below every other track's. **Seaside CORAL REEF** won out over its sibling **Seaside ENDLESS WAVES** for being noticeably longer (53 s vs 27 s) - a longer loop means whatever repetition is left to notice happens less often. This is a real judgment call standing in for an ear, not a proof; worth Chris's own listen on the preview link, and trivial to swap for a different track from the same bundle if it doesn't land.

**Reused the exact trigger points the camera shake already has.** Landing a swing on a tree or the raccoon, and taking damage, already call `camera.shake(...)` (0031); each now also plays a sound, from the same `treeHit`/`threatHit`/health-decreased moments. No new detection logic, and the same broadcast-to-everyone-nearby tradeoff 0031 already accepted and documented applies here too - a bystander occasionally hears someone else's hit, not just their own.

**Five variants per action, picked at random.** Kenney ships five numbered takes of each impact sound for exactly this reason - a single fixed sample played on every chop starts to sound mechanical fast. `sound.ts` picks one of five uniformly on each play. This is cosmetic randomness with no effect on the simulation, so it doesn't fall under the shared package's no-`Math.random()` rule (same reasoning as the shake's own jitter).

**Music starts on the same click that requests pointer lock, not at page load.** Browser autoplay policy blocks audio started without a genuine user gesture; `requestPointerLock()` is already exactly that gesture, already wired to the "Click to play" overlay, so starting the loop there needed no new UI. Verified in a real (if headless) browser that this actually avoids the autoplay block, since it's the one part of this change static analysis can't confirm on its own.

**One shared `Audio` element for music, a fresh one per sound effect.** The loop needs exactly one persistent, looping instance. Effects are fire-and-forget and can overlap (a flurry of hits), so each play creates its own `Audio`, the same one-and-done pattern already used for the game's HTML audio needs elsewhere - simplest thing that lets overlapping hits both play in full.

## Consequences

- Chopping, landing a hit, and taking damage all have both a camera kick and a sound now. A calm loop plays continuously once the player clicks in.
- Picking "the calmest track" by loudness/dynamics rather than by ear is a real, disclosed guess - not wrong to revisit if it doesn't actually feel right once heard.
- The music adds about 4 MB to what the client downloads - by far the single largest asset shipped so far, though still nowhere near the 25 MiB per-file limit, and it only loads once the player is already past the "Click to play" screen, same timing as the prop models.
- The bundle's other nine tracks, and the rest of Kenney's Impact Sounds categories (footsteps, glass, metal, punches, and more), came along but aren't used. Nothing stops a future pass from drawing on them - footstep sounds by terrain, in particular, are sitting right there unused.
- Everything here is CC0; Kenney and Abstraction/Tallbeard Studios are credited in `assets/LICENSES.csv` even though neither requires it.
