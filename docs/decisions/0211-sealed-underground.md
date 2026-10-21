# 0211 — Seal views beneath dug terrain

The underground backdrop had a terrain underside and a distant floor, but no
perimeter walls. A ray through a lining seam could still reach the sky horizontally;
distance fog also turned buried surfaces back into sky colour. Meanwhile, replaced
terrain skins around dig mouths were pickable but absent from camera collision.

Close the backdrop with perimeter walls following the actual terrain boundary and
a bottom below the lowest ground. Render its interior in unlit, unfogged earth
colours. Clamp only this backdrop’s clip-space depth to the far plane, so it
remains closed beyond the camera range without extending the scene draw distance.
The terrain underside still shares the live ground geometry, preserving
real dug openings. This is a visual enclosure, not a new collision floor.

Include both faces of rebuilt skins in camera blockers, with acceleration trees
and cleanup when digs replace them. Render tunnel lining and caps on both sides
so a close orbit cannot cull them away. Keep the shovel's pickable list separate
from the additional camera-only underside meshes. No movement, dig limits, saved
terrain, or network formats change.
