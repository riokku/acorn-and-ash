# 0239 — Keep landscape transitions quiet

All forest trees previously switched detail at the same 80 m radius, so a line of silhouettes could change together. Assign each tree a deterministic threshold within 74–86 m, with a 4 m return margin on either side. Reuse each tree's previous detail assignment when repacking. Each tree still occupies exactly one batch: no duplicate transparent crowns, extra draw calls or doubled shadows.

Widen the existing grass/litter transition slightly. Reuse existing texture grain to break up intermediate rock/sand boundaries while preserving pure 0/1 material regions. No new textures. Weather/plains haze now eases by elapsed time rather than frame count; view distance limits remain unchanged.

The `forest-distance` gallery reuses actual world terrain and forest viewpoints. `&before` selects the prior ground blending and uniform detail radius. Tests cover the distributed band, return-step stability, existing tree state/fall/collision behavior and equal haze response at 30/120 fps. This reduces clustered detail changes; it does not crossfade individual tree geometry.
