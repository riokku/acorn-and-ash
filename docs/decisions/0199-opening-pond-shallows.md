# Opening pond shallows

The opening pond still had solid collision cylinders at its waterline, so players could wade in the lake and river but could not enter the pond at all. Keep its existing outline, sunken bank, water appearance, fishing spots and scenery, but move its water barriers to the deep-water contour.

Deepen the bed from its previous 0.7 m depression to 1.2 m so the middle remains deeper than the wading limit. The shared bed still slopes over 2.5 m from the shoreline. Derive the inset contour from the same bed formula and the lake's 0.8 m wading limit. Shrink each pond collision circle by that distance; the union of these smaller circles matches the depth contour across overlapping lobes. Existing capsule collision keeps a player's entire radius out of deeper water. A lobe that never reaches that depth has no barrier.

Client prediction and authoritative movement build the same clearing colliders and walk on the same terrain. The pond renderer uses the shared water level. The existing shallow/deep colour gradient, fishing, building exclusions, wake effects and seasonal behavior are retained. No new messages, save migration or art assets are needed.
