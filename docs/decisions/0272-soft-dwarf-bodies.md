# Soft dwarf bodies, starting with Body 1

## Context

Chris wanted another pass at the player bodies: rounder, softer and a little
more realistic than the faceted dwarves of decision 0270, and less low-poly
than the Quaternius style, which he is fine with for now. Tripo is paid-only
for us, so we used Meshy on the free plan, which CLAUDE.md allows with CC BY
4.0 credit. Chris picked one of four Meshy pictures: a bald, beardless dwarf
in a cream shirt and brown shorts. Meshy turned it into a model. He approved
the cleaned-up result, then asked for a shorter nose and a warmer shirt.

## Decision

- **Meshy gives the shape only.** `tools/art/meshy_body.py` makes it
  game-ready in Blender. It reduces the model to about 8,200 triangles,
  keeping more of them in the face. It shortens the nose and cuts straight
  hems, sleeve ends and a collar. It colours the body by part and lays crisp
  eyes, brows and a smile on the face as thin pieces. Those pieces sit on the
  clothes material, so skin tone (decision 0113) leaves them alone.
- **Beards are ours,** modelled in Blender as soft, smooth-shaded shapes, all
  five per body under the same names as before (`<body>_Beard_<style>`).
- **A third body shape, `softDwarf`.** These bodies have the faceted dwarves'
  legs and hips, so seats, beds and the canoe still fit. Their chest is longer,
  which puts the arms at 0.86 m instead of 0.68 m. They get their own fitted
  skeleton (marked `softDwarf`), their own copy of the moves
  (`assets/animations/soft-dwarf.glb`, made by the same retarget script), and
  their own reach targets for eating, the whirlwind and paddling.
- **One body at a time.** Body 1 (`knight.glb`) changes now. Bodies 2 to 6 stay
  faceted until each is remade the same way, and they reuse this skeleton.
  `dwarf.glb` is now fitted from `barbarian.glb`.

## Consequences

- Body 1 is about 8,200 triangles plus at most one beard (300 to 1,400). That
  is over the faceted dwarves' 5,400 but under the 10k player budget. The file
  is 120 KB.
- A third move library loads until the last faceted body is replaced: about
  400 KB more.
- Meshy must be credited (CC BY 4.0) in `LICENSES.csv` and so on the credits
  page.
- The style no longer matches Quaternius. Whether to update the art row in
  CLAUDE.md is Chris's call once more bodies are done.
