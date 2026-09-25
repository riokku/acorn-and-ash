# 0033. A campfire you can light, an original model, and Claude's first Blender pass

**Status:** accepted · **Date:** 2026-09-25

## Context

Chris asked for one experiment covering three things at once: real art for the campfire (0020 shipped it as a placeholder cylinder-and-logs shape), an animated fire, and the ability to light and put it out. This was also the first time anything in this project's `assets/` folder would be built from scratch rather than adapted from a CC0 pack or run through an AI mesh-generation service - everything so far (0029, 0030) has been sourced, converted and re-exported, never modeled.

Two open design questions came back to Chris rather than being guessed at, per this repo's own rule: whether lighting a fire should do anything mechanical (it doesn't - cozy-light survival only tracks hunger and energy), and whether it needs fuel to keep burning. He answered both: atmosphere only for now, and it burns for a set time and goes out on its own, with an early put-out by hand also allowed.

## Decision

**Sequenced as three passes, not one blind attempt.** First a static model to prove the Blender-to-glTF pipeline works at all, then the animation on top of that once modeling itself was solid, then the mechanic last, since it is the one piece that touches every layer of the stack (shared sim, wire protocol, server storage, client input).

**Blender runs headless in this sandbox via `bpy` scripting, not an interactive session.** It isn't preinstalled, but installs cleanly from Ubuntu's own package archive - a different path from the CC0-asset sites this environment's network policy blocks. Three environment-specific snags came up and got fixed once: no GPU/EGL context, so Eevee cannot open one and Cycles on the CPU renders instead; this build has no OpenImageDenoiser, so denoising has to be turned off explicitly; and the glTF exporter needs `numpy`, which this Blender runs against the system Python directly and so installs with a plain `apt-get`. One more gotcha was about correctness, not environment: Blender 4.0's default AgX view transform lifts shadows for a filmic look, which reads a material's literal colour as noticeably lighter than specified - switched to the `Standard` transform so a colour picked in the script is the colour that ships.

**The campfire base is a genuinely modeled asset: five teepee-leaned logs over a beveled ash base, ringed with scattered rocks** (724 of its 1500-triangle budget), built with `mathutils` vector math rather than guessed Euler angles so the logs actually cross at a shared point instead of just tipping over in place.

**The flame is a second, separate glTF, not part of the campfire model, with its own baked animation clip.** Two overlapping cones - a wider orange outer body, a taller inner tongue poking past its tip - flicker via hand-placed, slightly randomised keyframes on scale and rotation rather than a smooth sine wave, so a 1.5-second loop reads as fire instead of something visibly mechanical. Emissive material strength was tuned down from an initial attempt that overexposed both layers to the same washed-out white, erasing the two-tone look entirely. This is the first animation clip anything in this client has ever played back: `model-loading.ts` gained `loadAnimatedModel` (loads the shared clip once, keeping the node hierarchy live rather than flattening it into static geometry the way `loadScaledModel` does for trees and rocks) and `instantiateAnimatedModel` (clones a fresh, independently-playable copy per campfire, since a `THREE.Object3D` can only sit in one place in the scene at a time).

**Both models are credited to Claude, not an external pack**, at Chris's choice: `assets/LICENSES.csv` lists them as CC0, authored for this project, sourced from this repo, with a note that they were built by script rather than by hand or through Meshy/Tripo (neither of which was used, so `ai_tool` stays blank - that field's allow-list is about AI mesh-_generation_ services specifically, not about who wrote the modeling code).

**Lighting is server-decided, atmosphere-only, and edge-triggered.** `BuiltProp` gained a mutable `lit` field and the wire format's `BuiltProps` message spent one more byte per entry on it (all non-campfire kinds just carry `false`). The interact key already reaches for a pickup, a gather patch and a buried cache in that order; a campfire is a new rung between the cache and eating from the pack, and holding the button near one claims that rung outright (so it never falls through to eating on every held tick) but only actually toggles on a fresh press - held-down input is naturally continuous at 10-15 Hz, and a toggle without that check would flicker the fire on and off for as long as the key stayed down. `CAMPFIRE_BURN_SECONDS` (10 minutes) drives a `campfireLitUntilMs` timestamp, checked once a tick the same way tree regrowth is - including a catch-up pass right after a world wakes from storage, so a fire that should have burned out while nobody was around already reads as unlit rather than waiting for the next real tick to notice.

**The 10-minute burn timing is tested with a fake clock in `packages/shared`, not a real wait anywhere else.** The game-server and browser tests cover what only those layers could get wrong - does a press reach the server and land on the wire, does the lit state survive a reconnect through real SQLite storage - and stop short of the actual duration, which is already exercised precisely (including the exact tick a fire is due) by the shared package's own tests.

## Consequences

- The campfire and its fire are the first hand-modeled, first animated, and first Claude-authored (rather than sourced) assets in the game, proving out a real pipeline for whatever gets modeled from scratch next.
- `assets/buildables/` is a new asset directory, alongside `trees/`, `rocks/`, `flowers/` and `audio/`.
- Every future `BuiltProp` costs one byte more on the wire than it used to, whether or not it can ever be lit.
- Nothing here adds warmth, cooking, or any other mechanical effect - Chris was explicit that this is atmosphere only for now. That door is open, not built.
- The flame's animation loading path (`loadAnimatedModel` / `instantiateAnimatedModel`) is generic, not campfire-specific, and ready for the next thing in this game that needs to move on its own.
