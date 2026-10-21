# 0212 — Species-specific low-poly fish

The held fish were a shared sphere and cone, distinguished only by color. Chris
explicitly authorized a non-Blender pass for this asset family. Build original
closed geometry in `fish-models.ts` for now, retaining the existing Z axis, origin
and approximate hand-sized bounds so carrying and eating keep their grip.

Perch have deeper bodies and barred flanks; trout have slimmer bodies, a muted
pink lateral band, spots and an adipose fin; golden carp have fuller gold bodies.
All have a tapered tail wrist, forked tail, solid fins, small eyes and gill lines.
Roasted variants keep their species geometry with toasted colors and char marks.
Geometry and materials are created once with the character's other held parts,
then reused by characters and the admin preview. The carved home trophies and
inventory icons remain separate illustrations.

This pass uses no new external assets or textures. Models remain below the
5,000-triangle creature budget. A fish gallery shows all three raw species and a
roasted trout for visual review; geometry checks guard finite coordinates and
hand-sized bounds. A future Blender pass can replace this family without changing
item IDs, gameplay, grips or saved inventory.
