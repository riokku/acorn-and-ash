# 0288. Heroic, faceted dwarves for Body 1 and Body 2

**Status:** accepted · **Date:** 2026-11-09

## Context

The two bodies were soft, rounded shapes made from Meshy models (decisions
0272 and 0275). Chris asked for both to be remade as beautiful low-poly dwarves
in the spirit of World of Warcraft: one man, one woman. Asked directly, he
chose:

- chunky and faceted, hand-modelled in Blender, matching the trees and rocks;
- the same start as now: a shirt, shorts and bare feet;
- the bodies first, with hats and tops left off until they are refitted in
  follow-up changes;
- the man keeps the five beards, the woman has hair only, skin tones and tints
  stay, and players should be able to choose a hair colour.

## Decision

- **Our own shapes.** `tools/art/heroic_dwarves.py` builds both bodies from
  scratch: loops of points skinned into a torso, limbs and head, and small
  faceted lumps for the nose, brows, ears, hands, toes, hair and beards.
  Nothing is AI-generated or taken from another model, so both files are CC0
  and no longer carry a Meshy credit. The style is original; nothing is copied
  from Warcraft.
- **Heroic, not cute.** A barrel chest, heavy shoulders, thick forearms, big
  hands and bare feet with toes, and a strong face under a heavy brow. Body 1
  has swept-back red hair in a knot and a braided beard bound in gold. Body 2
  has blonde hair in a bun and two long braids over her shoulders.
- **Flat-shaded, coloured per facet.** No textures. Each facet has one colour,
  varied a little from its neighbours, so the shapes read at game distance.
- **The same skeleton, untouched.** Both stand on the soft dwarves' skeleton
  (still marked `softDwarf`), so every move, seat, bed, the canoe and the hand
  targets for eating and fighting fit as they did. No move was refitted.
- **Three materials:** cloth, skin (shaded by the skin tone, as before) and
  hair. Hair, brows and beards are on the hair material, so a hair colour
  picker can be added without touching the models.
- **Pieces by name.** The body is `dwarf1` or `dwarf2`, the hair `<id>_Hair`
  and each beard `<id>_Beard_<style>`. Body 1 carries all five beards and
  shows the braids. Body 2 carries none.
- **Hats and tops wait.** They were cut to fit the soft bodies. A top is
  already left off a body it was not made for; a helm now is too. Their stats
  still count. The browser tests that expected them drawn now expect them left
  off, each with a note to turn it back when its family is refitted.

## Consequences

- Body 1 is 2,578 triangles with every beard and Body 2 is 2,320, against a
  budget of 10,000 and about 9,800 before. The two files are about 160 KB
  together, down from about 240 KB.
- Worn hats and tops are invisible on players until they are refitted: hats
  first, then tops. Trousers, boots and gloves were never fitted.
- The picker portraits were re-rendered from the new models.
- A tint still colours the whole character, skin included, as it did before.
  Whether a tint should colour only the clothes is a question for Chris.
- Still to do: a hair colour choice and a beard choice on the character
  screen. Neither needs new art.
- `soft-body1.blend` and `soft-body2.blend` stay as the sources the current
  hat and top fits were cut from, until those are refitted.
