# Painted field-journal icons

The approved HUD concept uses warm, dimensional object illustrations. The
existing one-color SVG silhouettes establish item identity but lack that
material treatment, especially in the pack and hotbar.

Use one transparent WebP atlas for an initial family of 16 everyday items:
axe, fishing rod, shovel, torch, berries, mushroom, raw and roasted meat, bag,
log, sticks, rope, reeds, bone, stone and forest stew. OpenAI image generation
created the art; its source and terms are recorded in `assets/LICENSES.csv`.

`ItemIcon` retains its decorative SVG wrapper and existing class names. An
image viewport selects the exact item's illustration. Measured visible bounds
center each object and fit its longest dimension to 82% of the icon box,
preserving aspect ratio. This avoids shrinking icons because of transparent
padding. Reviewed bounds exclude neighboring artwork. One shared asset is
cached across the interface.

Unmapped items, refined variants and buildable icons retain their distinct
SVGs. Further families can be added through explicit mappings after review;
basic artwork must not silently substitute for a different item or rarity.

`/?gallery=icons` shows the production icons at 13, 24, 30 and 40 pixels on
paper and fir backgrounds, alongside fallback examples. Small ingredient
icons accompany text; larger hotbar and pack icons must identify the object
through silhouette and broad material colors. Review crop boundaries,
transparency, contrast and actual-size readability before extending the set.
