# World-anchored dusk fireflies

The green dusk specks are a separate weather effect from summer pollen. Summer pollen was made world-relative in #211, but fireflies still added the player's coordinates to every flight each frame, keeping the same pattern attached to the character.

Give fireflies a fixed seeded world-space pool, independent of rain. Wrap outside a larger 64 m window, fade at its far border, and keep airborne height stable until a flight is recycled. The larger pool retains the original density; only gentle flight and blinking move the visible specks. A player or orbiting camera moves through the field.

Retain dusk, storm, blizzard, indoor and reduced-motion behavior. The existing trees gallery can show the effect at a chosen time. No new geometry, textures or weather rules.
