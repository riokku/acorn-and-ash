# 0238 — One world-space breeze

Grass, seasonal particles and trees previously had independent motion or none. Share a smoothed, bounded weather strength, direction and slow traveling gust field. GPU grass, tree crowns and shoreline reeds use that field; the existing particle pools integrate it in both horizontal axes. Grass under heavy ground cover responds less. No extra draw calls, model assets or per-tree frame updates.

Trees store their world root and inverse yaw per instance so near/distant meshes sample the same gust and bend in the same world direction. Squared height leaves bases planted; crown displacement is modest. Shoreline reeds reuse their untextured UV height for anchored bending, with stalks and cattail heads sharing a height scale.

Reduced motion immediately zeros wind strength and stops its clock. Weather changes ease instead of snapping and a resumed tab cannot advance more than a tenth-second per update. Inspect shipped trees using `?gallery=tree-models&wind`; `&before` disables wind and `&at=3&still` gives repeatable comparison frames. This changes runtime deformation, not model geometry or textures.
