# 0284 — Tops fitted to the soft bodies

## Context

After the hats (`0283-hats-fitted-to-soft-bodies.md`), every top still stayed
hidden on Body 1 and Body 2: the linen shirt, traveller's tunic, warm jacket and
Cedarstalker coat were skins grown out of the old KayKit bodies, which are a very
different shape. A head is round enough for one hat to fit both bodies; a torso is
not. Body 2 is narrower in the shoulders and has braids hanging over her chest.

## Decision

- Each top is one file holding two fits, `<top>_body1` and `<top>_body2`, on the
  shared Rig_Medium skeleton. The client draws only the wearer's fit, chosen by the
  name of the body's own mesh.
- A fit is cut from its body's own mesh, so it keeps that body's skin weights and
  bends with it exactly. It is pushed out along the surface, given a smooth
  neckline, straight hems and cuffs, coloured bands and a thin rim, and kept under
  2,000 triangles. The coat adds a flared skirt weighted from the hips. Body 2's
  braids and every beard stay on top of the cloth.
- While a top is worn, the game leaves out every body triangle it covers
  completely (`hidden-under-clothes.ts`): looking straight out from the skin, each
  corner meets the inside of the cloth, or the skin stands just proud of it. The
  body underneath can then never poke through, however it bends. Triangles at a
  cuff, collar or hem keep a corner in the open, so there is no gap. The result is
  worked out once for each body and top, at rest, and shared.
- `tools/art/soft_tops.py` rebuilds all four; `assets/gear/soft-tops.blend` is the
  source.
- Because the fits are cut from the Meshy body shapes, the files carry the bodies'
  CC BY 4.0 credit.

## Consequences

Players can see their tops on both bodies, and other players see the same. A third
body would need a third fit in every top. Up close, a sliver of the plain shirt's
collar can show above some necklines. Trousers, boots and gloves still need fitted
art.
