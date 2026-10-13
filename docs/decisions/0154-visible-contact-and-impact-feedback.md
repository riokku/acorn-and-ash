# Visible contact and impact feedback

Distance-only footstep timing could drift from the visible gait and play while
boats or full-body moves carried grounded feet. Surface sounds ignored shallow
water, snow and frozen water. Creating a new audio element per hit also left
recordings cold and unbounded during repeated effects.

Use the rig's shared contact phase and rendered position for walking feedback;
placeholders retain distance scheduling. Brief inactive prediction frames retain
the last contact phase, while pause, space changes and teleports reset it. Suppress stationary, airborne and
inactive-stride steps, keep one centered landing, and never replay teleports or
long frames. Classify surfaces only on contact and reuse the existing procedural
forest bus for water/snow/ice. Warm existing impact recordings while loading,
reuse at most three voices per variant, update volume immediately and stop tails
on pause/hidden/disposal. Reduced motion clears and suppresses cosmetic camera
shake while preserving manual orbit, clearance and ordinary controls.

This pass builds on the contact-aligned stride API. Tests exercise phase timing
at 30/60/144 FPS, surfaces, inactive poses, audio lifecycle/bounds and reduced
motion, plus real browser walking/rest/landing. No new sound files or assets.
