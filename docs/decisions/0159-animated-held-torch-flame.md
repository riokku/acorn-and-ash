# 0159 — Animated held torch flame

## Context

A carried torch supplied flickering light but had no visible animated fire. The game already loads the original animated campfire flame asset.

## Decision

Instantiate that existing emissive flame at the torch wick, scaled to a handheld fire. Attach it to the same anchor as the torch glow, following the hand while cancelling the parent's rotation so the flame rises upright. Advance its animation only when the torch is visible. Reduced motion keeps the flame visible with animation paused. Stagger instances and clamp resumed-frame animation time.

## Consequences

Carried torches show real animated flame without new art assets or additional lights. Equipping another item hides both torch and flame; destroying the character releases the private animation copy without disposing shared asset geometry or materials. Asset-load failures retain the existing glow fallback.
