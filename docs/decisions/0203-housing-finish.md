# 0203 — Woodland housing finish

The cabin roof relied on a flat texture and the tent/teepee canvas on single
triangles. Add a compact Blender-authored detail kit to the existing home models:
overlapping cedar shakes, eased fascia and timber braces, shutters and ironwork,
and smooth canvas panels with relaxed tension folds.

The kit preserves the existing entrances and footprints. Cabins retain their
terrain-fitting foundations, window lighting and counted log storage. Shelters
retain their poles, ropes, seams and lanterns; their original flat canvas remains
a fallback when the optional asset is unavailable. Shared immutable templates
are loaded before world construction; clones do not own the cached resources.
Each named module stays below 2,000 triangles (6,548 across all eight modules).
The reproducible source is `tools/art/housing_details.py`, built with headless
Blender in this workspace, with the `.blend` and compressed `.glb` checked in.

Remove the spring petal and autumn leaf particle densities, including seasonal
crossfades. Keep their diagnostic keys for compatibility, always zero, and retain
summer pollen, winter snow, rain and blizzards.
