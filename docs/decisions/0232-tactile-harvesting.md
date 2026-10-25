# Tactile plant harvesting

## Context

Gathering already removed individual visible pieces, played a pickup clip and confirmed the material with sound. The plant nevertheless disappeared before the hand reached toward it, making picking feel disconnected from the world.

## Decision

Reuse the existing flower, reed, berry and mushroom models for a short presentation over confirmed gathering. A piece removed by a patch-count update gets a temporary visual copy: it bends at its base, lifts toward the collecting character's hand and shrinks away over 0.65 seconds. The original piece stops being an interaction target immediately. Nearby collection receipts attach the visual to the correct actor regardless of whether counts or collection messages arrive first.

A bounded arm correction steers the existing pickup pose toward the plant, then lifts the hand back toward the body. Held tools hide briefly. Movement, jumping and combat interrupt the correction without delaying input or changing position. Flowers and forage get a soft rustling layer using the existing synthesized audio system.

All of this is client presentation. Inventory, cooldowns, counts and range checks remain server-owned and immediate. No new assets, requests, message bytes or persisted fields are needed. The isolated gallery is `?gallery=harvesting`, with `&at=0.32` for inspection and `&before` for comparison.

## Consequences

Temporary visuals are capped at 32 and reuse geometry while owning their materials. Patch replacement, scene changes and disposal remove them before source geometry is released. Missing or distant hands fall back to a small lift and fade. Reduced motion skips detached plant motion. Existing pickup animation and material sounds remain the fallback for other items; delayed gameplay rewards and tool-contact harvesting are outside this change.
