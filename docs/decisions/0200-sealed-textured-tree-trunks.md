# Sealed, textured tree trunks

The odd-sided trunk rings used alternating radii at their duplicated UV seam,
so the first and last corner disagreed and left a visible vertical slit.
Some branch tubes also had open ends, and the optimizer removed bark UVs
because textures are assigned by the game rather than embedded in the asset.

Rebuild all five species, three shapes and both distance levels in Blender.
Use periodic ring profiles, welded seam positions with separate corner UVs,
closed ends, smooth trunk sides, a continuous alder stem, and overlapping
maple forks. Add root profile detail and rounder maple/alder leaf clusters.
Preserve runtime texture attributes with an explicit importer option.

The existing sizes, pivots and bark/foliage material split remain compatible
with grounding, seasonal colors and progressive burning. Detailed trees stay
below 4,000 triangles and distant trees below 800. Broadleaf downloads grow
for the fuller foliage. A tree-model gallery supports visual inspection;
the shipped-asset check rejects open bark and missing texture coordinates.
