# 0008. Jump and sprint

**Status:** accepted · **Date:** 2026-09-19

## Context

Phase 0 gave the player one way to move: walk at 4.5 m/s. Walking the 64 m
clearing end to end takes about fifteen seconds, which makes trying anything out
slow, and a character who cannot leave the ground reads as heavy rather than
cozy.

Chris asked for jump and sprint before Phase 1 starts.

## Decision

Two buttons, both part of the same movement rule in `packages/shared`:

- **Shift, held:** sprint at 7 m/s instead of 4.5 m/s. It costs nothing today.
- **Space:** a hop of 1.26 m that is over in 0.65 s. Only from the ground.

Both travel in the `buttons` byte that every input already carries, so the
network format is unchanged. The client predicts them the instant the key goes
down and the server runs the identical function as the authority, exactly as it
already does for walking.

Three rules make this safe to take from a client:

- A jump only starts when the server agrees the player is on the ground, so
  holding or spamming Space cannot climb the sky.
- In the air a player gets 35% of their usual acceleration, so a jump commits
  you to roughly where you were heading.
- Sprint sets a top speed, it does not add one, so it cannot be stacked with an
  oversized `moveZ` to go faster still.

## Consequences

- Sprinting is free. Phase 2 adds energy (the settled survival model is hunger
  and energy only), and sprint is the obvious thing to spend it on. The speed
  constant is in one place for when that happens.
- **You cannot jump onto anything yet.** Collision pushes the player out of
  trees and rocks sideways only, against a flat height map; there are no
  surfaces to land on. Jumping is for feel and for hopping small dips, not for
  reaching places. Standing on things is Phase 3 work, with the cabin.
- Holding Space hops again the moment you land. That is forgiving rather than
  precise, and is a one-line change in the client if it reads as sloppy.
- Snapshots gained a `Sprinting` flag next to `Moving` and `Airborne`, derived
  from speed rather than from the button. A player shoving a tree at walking
  pace is not sprinting, whatever they are holding, which is what an animation
  will want to know later.
