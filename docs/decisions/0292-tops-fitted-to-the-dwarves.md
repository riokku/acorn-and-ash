# 0292. Tops fitted to the faceted dwarves

**Status:** accepted · **Date:** 2026-11-10

## Context

When Body 1 and Body 2 became faceted dwarves (decision 0288), the four tops
were left off them: each had been cut from a soft body's own mesh (decision
0284), and the new bodies are a different shape. The hats were refitted first
(decision 0291). This is the tops.

## Decision

- **Each top is built the way the dwarves are.** The bodies are made from
  loops of points (`tools/art/heroic_dwarves.py`). `tools/art/dwarf_tops.py`
  takes the same loops, pushes them out a little, and makes a body, two
  sleeves and bands for the collar, cuffs, hem and belt. Flat-shaded and
  coloured per facet, like the bodies. `assets/gear/dwarf-tops.blend` is the
  source.
- **It bends as the body does,** because each point is weighted to the same
  bones by the same rule as the body under it.
- **The four tops keep their look:** the linen shirt with long sleeves and
  plain bands; the traveller's tunic with elbow sleeves, a belt and a buckle;
  the warm jacket, quilted, with a pale wool collar, cuffs and hem; and the
  Cedarstalker coat with a belt and a flared skirt that follows the legs
  halfway, so it swings.
- **One file per top, two fits in it,** named `<top>_dwarf1` and
  `<top>_dwarf2`. The game draws the wearer's fit and leaves out the parts of
  the body it covers, exactly as before; it now knows the dwarves' names as
  well as the soft bodies'.
- **Nothing here is AI-made,** so the four files are CC0 and lose their Meshy
  credit. The browser test that expected tops left off expects them drawn
  again, one fit per body.

## Consequences

- Players see their tops again, on both bodies, and so does everyone else.
- Each fit is 766 to 898 triangles, against the props' budget of 2,000 and
  about 1,950 before.
- A top closes at the neck, so the plain shirt's lacing does not show. Body 1's
  beard and Body 2's braids lie over the cloth.
- Trousers, boots and gloves still have no fitted art on any body.
- Nothing in the game now comes from the soft bodies. Their sources
  (`soft-body1.blend`, `soft-body2.blend`, `soft-hats.blend`,
  `soft-tops.blend` and the three scripts) are the only files left that carry
  a Meshy credit. Whether to delete them is Chris's call.
