# Soft dwarf bodies, starting with Bodies 1 and 2

## Context

Chris wanted another pass at the player bodies: rounder, softer and a little
more realistic than the faceted dwarves of decision 0270, and less low-poly
than the Quaternius style, which he is fine with for now. Tripo is paid-only
for us, so we used Meshy on the free plan, which CLAUDE.md allows with CC BY
4.0 credit. Chris picked one of four Meshy pictures: a bald, beardless dwarf
in a cream shirt and brown shorts. Meshy turned it into a model. He approved
the cleaned-up result, then asked for a shorter nose and a warmer shirt. Next
he asked for the woman's equivalent as Body 2, and to pause the other bodies.

## Decision

- **Meshy gives the shape only.** `tools/art/meshy_body.py` makes it
  game-ready in Blender. It reduces the model to 7,000 to 8,200 triangles,
  keeping more of them in the face. It shortens a long nose and cuts straight
  hems, sleeve ends, a collar and a hairline. It colours the body by part and
  lays crisp eyes, brows, lashes and a smile on the face as thin pieces. Those
  pieces sit on the clothes material, so skin tone (decision 0113) leaves them
  alone.
- **Hair and beards are ours,** modelled in Blender as soft, smooth-shaded
  shapes. Meshy is asked for hair pulled back tight; Body 2's braids are built
  on top (`<body>_Hair`). Every body has all five beards under the same names
  as before (`<body>_Beard_<style>`), moved to fit its face.
- **A third body shape, `softDwarf`.** These bodies have the faceted dwarves'
  legs and hips, so seats, beds and the canoe still fit. Their chest is longer,
  which puts the arms at 0.86 m instead of 0.68 m. They get their own fitted
  skeleton (marked `softDwarf`), their own copy of the moves
  (`assets/animations/soft-dwarf.glb`, made by the same retarget script), and
  their own reach targets for eating, the whirlwind and paddling.
- **One skeleton for all soft bodies.** Some moves place the shoulders, so a
  body whose arms sit elsewhere would be pulled out of shape. Each new body's
  arms are moved onto the shared skeleton instead (Body 2's by 3 to 4.5 cm).
- **Calmer arms.** The longer arms swung up nearly to shoulder height, so in
  the soft moves the walk keeps half its arm swing and the run 55%, centred on
  how the arms hang at idle.
- **One body at a time.** Body 1 (`knight.glb`) and Body 2 (`barbarian.glb`)
  are soft now. Bodies 3 to 6 are paused at Chris's request and stay faceted.
  `dwarf.glb` is now fitted from `mage.glb`.

## Consequences

- Each soft body is at most about 9,800 triangles with its biggest beard,
  under the 10k player budget. Each file is about 120 KB.
- A third move library loads until the last faceted body is replaced: about
  400 KB more.
- Meshy must be credited (CC BY 4.0) in `LICENSES.csv` and so on the credits
  page.
- The style no longer matches Quaternius. Whether to update the art row in
  CLAUDE.md is Chris's call once more bodies are done.
