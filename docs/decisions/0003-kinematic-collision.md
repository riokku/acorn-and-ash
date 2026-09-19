# 0003. Our own kinematic collision instead of a physics engine

**Status:** accepted · **Date:** 2026-09-17

## Context

The server owns every position, and it runs inside a Durable Object with 128 MB
of memory and a 10 ms tick budget. A full physics engine like Rapier is
WebAssembly, which Workers can only load if it is imported at build time, and it
would cost memory and tick time we would rather spend on gameplay.

Acorn & Ash also does not need physics. Nothing tumbles or stacks. The player
walks around trees and rocks on mostly flat ground.

## Decision

Write the collision ourselves, in `packages/shared/src/collision`.

- The player is a capsule described by the position of its feet, a radius and a
  height.
- Trees are cylinders. Rocks and future walls are boxes that may be rotated
  about the Y axis.
- Each tick the player is moved, then pushed back out of anything it ended up
  inside, then held inside the playable area. The push repeats up to six times so
  that being wedged in a corner resolves properly.
- Ground height comes from a `Terrain` interface. Phase 0 returns a constant;
  Phase 1 can return a real height map without touching movement code.
- Overlaps below `COLLISION_SKIN_WIDTH` (0.1 mm) are ignored, so a player leaning
  on a tree does not jitter.

On the client, `three-mesh-bvh` is used for camera collision and raycasts
against the rendered scene. That is a rendering concern, not a gameplay one.

## Consequences

- No WebAssembly in the Durable Object, and a tick that stays comfortably inside
  budget with 50 players.
- The exact same code runs on the client for prediction, so the two agree.
- Everything is a cylinder or a box. Sloped ground and moving platforms would
  need more work, and neither is planned.
- If Phase 4 combat ever needs real physics for thrown objects, this decision
  will need revisiting.
