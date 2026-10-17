# Shared curling fire

The old two-piece flame rotated and scaled as a whole. Campfires and hearths
also started together and kept animating under reduced-motion preferences.

Use a Blender-authored, six-second morph animation with five outer tongues
and three inner tongues. Three independent curling waves leave the fuel
contact anchored. The emissive inner core shows through a translucent orange
outer layer. The asset remains two draw parts and 992 triangles, including
when reused by the bounded wildfire pools. Keep the editable Blender source.

One instance helper owns timing, staggered starts, hidden/reduced-motion
pausing and mixer cleanup for campfires, hearths, torches and wildfires.
Torch attachment still keeps the flame upright. Firelight uses gentler,
slower variation and becomes steady for reduced motion; sheltered lamps keep
their existing steady glow. Fuel, heat, damage and spread rules are unchanged.

Asset checks verify anchored deformation, triangle budget and matching loop
endpoints. Client tests cover independent instances, suspended-tab deltas,
reduced motion, relighting and shared-resource ownership.
