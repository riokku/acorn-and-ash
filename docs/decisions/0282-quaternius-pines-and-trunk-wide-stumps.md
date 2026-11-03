# 0282 — Quaternius pines, and stumps as wide as their trunks

## Context

On 3 November 2026 Chris asked for the main tree (the `pine` kind, the most
common one) to use a mixture of Quaternius's pines from Poly Pizza, and for a
felled tree's stump to be the same size as its trunk. Stumps were often much
thinner than the trunk they came from, which looked wrong after chopping.

Two things made them thin. The table's trunk widths came from the first
placeholder trees, and the real trunks are 25–80% wider. And the Polyfork stump
model's 0.42 m radius is its root spread; its sawn trunk is only 0.19 m.

## Decision

- **Five Quaternius pines.** Pine_1 to Pine_5 from the Stylized Nature MegaKit
  (CC0, the pack our art style matches) replace the three Douglas-fir shapes.
  Being CC0, they are committed to `assets/trees/` with licence rows.
  `tools/art/quaternius-pines.mjs` downloads and prepares them. It renames the
  materials, drops the bark textures (the game paints its own bark), makes the
  needle cards double-sided cut-outs, flattens root tips below the base, fits
  the 4,000-triangle budget and makes 800-triangle distant versions. They are
  used as they are, without a Blender pass, like the earlier Quaternius
  imports.
- **Stumps are measured, not guessed.** The client slices each tree shape's
  bark 0.4 m up when it loads and sizes that tree's stump to match. The
  Polyfork stump is widened, not raised, so its sawn trunk is the stump's table
  radius, the same as the placeholder stump.
- **Stumps wear their tree's bark.** Chris also asked that a stump look like
  it came from its tree; the Polyfork stump's flat light-brown sides did not.
  Its sides now use the trunks' painted bark, wrapped once around like the
  trunks, and each stump takes its tree kind's bark tint. The sawn top keeps
  its lighter wood.
- **The table follows the art.** The table's trunk widths were updated to the
  measured trunks, so the server's stump collision matches what you see.
  `tools/check-tree-trunks.mjs` fails if a future model drifts from the table.

## Consequences

- Each stump fits its own tree, including the stouter fifth pine and the
  thick-trunked maples.
- The stump where the first axe waits is drawn wider than before. It now
  matches the collision that was already there.
- A stump's roots now spread wider than the standing tree's collision, so the
  tests no longer say a stump is narrower than its tree. They check that it is
  low, can be climbed onto, and is as wide as the trunk at the cut.
- The `pine` kind is still labelled "Douglas-fir" in game until Chris picks a
  name.
- The Douglas-fir models stay in `assets/trees/` and `trees.blend`, unused.
