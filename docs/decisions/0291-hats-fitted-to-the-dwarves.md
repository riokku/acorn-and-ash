# 0291. Hats fitted to the faceted dwarves

**Status:** accepted · **Date:** 2026-11-10

## Context

When Body 1 and Body 2 became faceted dwarves (decision 0288), every hat was
left off them: the hats had been cut to fit the soft bodies' heads (decision
0283), which were smaller and sat differently. Chris agreed to that for a
short while, with the hats to be refitted first and the tops after.

## Decision

- **Every helm-slot piece is refitted in Blender** by `tools/art/dwarf_hats.py`:
  the knight's helmet, mage's hat, bear hat and rogue's mask from the KayKit
  pack, the wool cap, and the worn copy of the Last Watch helm (which the
  king's crown still borrows). `assets/gear/dwarf-hats.blend` is the source.
  The files keep their names, so nothing else changes.
- **One hat fits both bodies.** They share a skeleton and their heads are
  nearly the same size. Each hat is sized over whichever head, hair included,
  reaches further, and is weighted wholly to the head bone.
- **The knot and the bun come off under a hat.** They stand above the hair and
  would poke through. Each is now a piece of its own in the body file,
  `<id>_HairTop`, which the game hides while a hat is worn. The rest of the
  hair stays, so hair still shows under the brim and Body 2 keeps her braids.
  The rogue's mask leaves the top of the head bare, so the knot stays with it.
- **Helms are drawn again on every body.** The check added in 0288 that left a
  helm off an unfitted body is gone, and the three browser tests that expected
  hats left off expect them drawn again.

## Consequences

- Players see their hats again, on both bodies, and so does everyone else.
- The body files changed (the hair was split in two), so the picker portraits
  were re-rendered. They look the same.
- Tops are still left off the dwarves until they are refitted; that is the
  next change. Trousers, boots and gloves were never fitted.
- `soft-hats.blend` and `tools/art/soft_hats.py` are no longer the source of
  any file in the game. They stay as a record until the tops are refitted,
  when the soft bodies' sources can all go together.
