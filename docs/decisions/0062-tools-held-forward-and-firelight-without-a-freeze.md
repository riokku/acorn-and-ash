# 0062. Tools held forward, and firelight without a freeze

**Status:** accepted · **Date:** 2026-10-02

Changes [decision 0047](0047-a-torch-and-real-firelight.md) (how firelight is
made) and the carry from [decision 0058](0058-the-axe-blade-first.md).

## Context

Chris reported two things. Carried tools stood too upright: walking, the
torch's flame went into the character's hair, and the axe and rod ended
up behind them. And the game froze for a moment whenever a campfire was
lit or a torch taken out.

Measured in the moves gallery, the carry was fine standing still (torch and
rod 30 degrees forward, axe 45), but the walk's arm swing turned the hand,
and everything in it, through about 60 degrees each stride. At the back of
the swing the torch leaned 52 degrees _backwards_.

The freeze came from how Three.js draws lights: every material's shader is
built for the exact set of lights in the scene. Each fire added or showed its
own light, so lighting a campfire, putting it out, or taking out a torch
changed that set and rebuilt every shader in view at once. In the test
browser, one frame took 0.85 to 1.2 seconds for the campfire and 0.25 to
0.35 seconds for the torch, every time.

## Decision

**Tools lean further forward, and the wrist holds them steady.** Each long
tool now has one carry angle: torch and rod 45 degrees forward, axe 55. All
of them tip 12 degrees out to the right, so the helmet doesn't hide them from
the camera behind. While walking or running, the tool turns 80% of the way
toward that same angle held against the body instead of the hand, so it no
longer swings back with every stride. Walking, the torch now stays 29 to 38
degrees forward, the axe 40 to 50 and the rod 30 to 40. Moves, gestures,
rolls and resting still use the hand's own grip, as before.

**Fires no longer own lights.** Each fire has a "glow": a marker where the fire
is, with the colour, brightness and reach its light should have. Six real
point lights (`FireLights` in `apps/client/src/scene/fire-light.ts`) are
added to the scene once and never removed. Every frame, they move onto the
six glows nearest the camera, and any spare light is turned down to
nothing. The set of lights never changes, so no shader is ever rebuilt.
Measured the same way, both freezes are gone: 2 to 9 milliseconds a frame.

## Consequences

- Only six fires light the scene at once. A seventh further away still glows
  but lights nothing around it, and can pop on when you walk nearer. If
  playtests with many players show this, the count is one number.
- Every material now pays for six point lights all the time, even by day,
  where before it paid only for the fires that were lit. This is a small
  cost per pixel on a desktop graphics card.
- `?gallery=moves` has `walk` and `run` demos and an `&item=` option for
  checking how anything is carried.
- Going into or out of a home still swaps the fog off and on, which causes
  the same kind of rebuild. That is left for its own change.
