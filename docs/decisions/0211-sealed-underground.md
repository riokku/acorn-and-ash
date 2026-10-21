# 0211 — Seal views beneath dug terrain

The underground backdrop had a terrain underside and a distant floor, but no
perimeter walls. A ray through a lining seam could still reach the sky horizontally;
distance fog also turned buried surfaces back into sky colour. Meanwhile, replaced
terrain skins around dig mouths were pickable but absent from camera collision.

Close the backdrop with perimeter walls following the actual terrain boundary and
a bottom below the lowest ground. Render its interior in unlit, unfogged earth
colours. Extend the follow camera and outdoor gallery far plane to 1,500 m,
enough to contain the 940 m terrain enclosure even diagonally. Otherwise the
far clip plane can cut away its walls and reopen the sky below ground. Keep
normal depth projection; clamping backdrop vertices independently caused
silhouette artifacts at steep camera angles. Existing fog and object distance
culling still control what is visible above ground, though the larger frustum
can admit additional distant geometry.
The terrain underside still shares the live ground geometry, preserving
real dug openings. This is a visual enclosure, not a new collision floor.

Include both faces of rebuilt skins in camera blockers, with acceleration trees
and cleanup when digs replace them. Render tunnel lining and caps on both sides
so a close orbit cannot cull them away. Keep the shovel's pickable list separate
from the additional camera-only underside meshes. No movement, dig limits, saved
terrain, or network formats change.
