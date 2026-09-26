# 0039. Plain Three.js for the scene, not React Three Fiber

**Status:** accepted · **Date:** 2026-09-26

## Context

Chris asked, in plain terms, whether the game's 3D code should move to React
Three Fiber (R3F) - a popular way to build Three.js scenes as React
components - instead of the hand-written scene code in
`apps/client/src/scene` and the manual render loop in `apps/client/src/game.ts`.

The two are not equivalent tools for this game. R3F's strength is letting a
scene be described declaratively and re-rendered when React state changes,
which suits scenes that are mostly static between interactions. This game is
the opposite: the server sends a snapshot 10-15 times a second, and on every
one of the client's own frames dozens of entities (the local player, every
other player, every animal, every fishing float) have their positions and
animation state written directly, as fast as possible. `Game.frame()` already
does this the direct way - reading server state and writing straight into
`THREE.Object3D` transforms - with React confined to `apps/client/src/hud`
and `apps/client/src/home`, where it belongs.

## Decision

Keep the current split: plain Three.js and a hand-rolled render loop for the
3D world, React only for the HUD, menus, and the pre-game Home screen. Do not
adopt React Three Fiber.

Reasons:

- **The hot path stays direct.** Every entity update in `Game.frame()` is a
  straight write to a mesh's transform. Routing that through React's
  component tree would mean either re-rendering constantly (wasteful) or
  reaching for refs and imperative escape hatches to bypass React anyway -
  paying for a declarative layer without using it where it matters most.
- **No player-visible upside.** This is purely an internal code-organization
  choice; it changes nothing about how the game looks, feels, or performs
  for the better. Given that, the bar for rewriting already-working, tested
  scene code is high, and R3F does not clear it.
- **It matters more, not less, at scale.** Phase 5's goal is 50 bots plus 10
  players staying smooth in one world. Fewer layers between "the server said
  this" and "the screen shows it" makes that budget easier to hit and easier
  to profile when it slips.
- **The split we have is the correct one already.** React genuinely fits the
  HUD and menus - text and controls that change on discrete state updates -
  and that's exactly where it's used. R3F would blur that line rather than
  sharpen it.

## Consequences

- No code changes from this decision; it confirms the structure already in
  place in `apps/client/src/scene`, `apps/client/src/game.ts`, and
  `apps/client/src/hud`.
- Future scene code keeps being written as plain functions returning a
  `THREE.Group` plus `dispose()` (see `scene/critter.ts`, `scene/campfire.ts`,
  and the like), driven each frame from `Game`, not as React components.
- The real cost we're accepting: R3F's ecosystem (`@react-three/drei` and
  similar) ships a lot of ready-made helpers - loaders, camera rigs,
  postprocessing - that we keep building by hand instead of getting for free.
  Worth revisiting only if that hand-built cost starts outweighing the
  performance and simplicity we're optimizing for here, which nothing so far
  suggests.
