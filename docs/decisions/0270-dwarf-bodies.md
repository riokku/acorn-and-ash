# Dwarf bodies

## Context

The six player bodies were the KayKit Adventurers with their outfits lifted
off (decision 0112). Chris wanted characters of our own: chubby, goofy,
faceted dwarves, three men and three women, made in Blender (decision 0105).
His calls, made before the bodies went in:

- An old character becomes the dwarf with the same number (Body N stays
  Body N), keeping its skin tone and everything it has earned.
- Gear keeps working on a dwarf but is not drawn on one until it has been
  refitted, one gear family per pull request.
- Any body can wear any beard: none, braids, long, full, stache or chops.
- Moves should end up bouncy and waddly, made for dwarves in Blender over
  several pull requests.

## Decision

- **Bodies.** `tools/art/dwarf_bodies.py` builds each dwarf from metaballs,
  decimates it into facets and colours it face by face. Each exports under the
  old body's file name (`knight.glb` is Body 1 and so on), so saves, the wire
  and the character screen need no change. Every file carries all five beards
  as separate parts named `_Beard_<style>`. The game shows one at a time
  (`showBeard`), for now each body's own default (`BODY_BEARD`). Choosing a
  beard in character creation comes in its own pull request.
- **Skeleton.** The dwarves keep the pack's Rig_Medium skeleton and bone
  names, refitted to their proportions. The rig node carries `dwarf: true` in
  its glTF extras, which is how the game tells a dwarf from the adventurer
  skeletons the raiders still use (`bodyShapeOf`).
- **Moves.** `tools/retarget-dwarf-animations.mjs` copies the 38 shared clips
  onto the dwarf skeleton as `assets/animations/dwarf.glb`. Each turn is
  carried from the pack's resting pose to the dwarf's, and each stride and
  bob is shortened to the dwarf's legs (0.838 as long). The game loads one
  move library per body shape. Moves that steer a hand to a point (eating,
  the whirlwind, paddling) take per-shape targets, because a dwarf's mouth and
  reach are lower and shorter. New dwarf moves made in Blender replace clips
  in `dwarf.glb` with `tools/add-animation.mjs`, one group per pull request.
- **Gear.** Helms and garments fitted to the old bodies are not built on a
  dwarf. Held items and the shield still are, because they hang from the hand
  bones, at three quarters of their size on the ground (`HELD_SIZE`). At full
  size an axe was nearly as tall as a dwarf and its swing scraped the ground.
- **Size.** The dwarves keep the old model scale. Their legs are nearly as
  long as the old bodies' (the old height was mostly head), so chairs, beds and
  the canoe still fit. A dwarf stands about 0.8 m tall in the game, against
  1.2–1.4 m before. The follow camera is unchanged.

## Consequences

- A dwarf with its five beards is about 7,400 triangles in the file, but at
  most about 5,400 are drawn. `tools/import-model.mjs` gained a `--quantize`
  option, which keeps each file under 300 KB.
- Two move libraries are loaded instead of one, about 400 KB more.
- Until gear is refitted, wearing it changes your stats but not your look.
- `tools/art/plain_bodies.py` and `plain-bodies.blend` stay as the source of
  the gear lifted off the old outfits.
