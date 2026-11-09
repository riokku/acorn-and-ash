# 0286. A far skyline, and Ash Peak

**Status:** accepted · **Date:** 2026-11-09

## Context

Chris asked for the world to feel like the mountains of the Pacific Northwest,
and chose the skyline as the place to start. Until now the sky was one flat
colour, and fog hid everything beyond about 120 m, so there was no far
distance at all: no ridges, no big mountain, nothing to walk towards.

## Decision

**A far country that is scenery only.** Beyond the 470 m where the ground
ends, each player's game draws three rings of forested ridges (640 m, 900 m
and 1,250 m out) and one great snow-capped volcano, Ash Peak, 1,650 m to the
north-east, straight out across the lake. Nobody can walk there and the server
knows nothing of it. The ridges come from the world's seed
(`apps/client/src/art/skyline-shape.ts`), so everyone in a world sees the same
skyline. They stand still in the world, so walking across the map slides the
near ridges past the far ones a little, as real distance does.

**Ash Peak is a Blender model** (`tools/art/ash_peak.py`,
`assets/terrain/ash-peak.glb`, 1,188 triangles), made at 1:100 and drawn 110
times larger: about 730 m tall. The ridges dip where they pass in front of it.

**Not fogged, but coloured from the fog.** Fog would hide all of it, so these
pieces ignore fog. Each is instead mixed towards the sky's horizon colour by
how far away it is, and melts into that colour at its foot. The sky itself now
deepens overhead instead of being one colour. Nothing about the fog, the
light or the weather in the playable world changes.

**It follows the day, the weather and the season.**

- Night leaves the ridges as dark shapes and the snow dimly moonlit.
- Around sunset and sunrise the high snow turns pink.
- Rain closes in from the furthest thing first: in a downpour Ash Peak is
  nearly gone, so "the mountain is out" only on a clear day. A blizzard hides
  everything, and so does going underground or indoors.
- In winter the snow line on the ridges comes down.

**The camera sees further**, 4,000 m instead of 1,500 m, so the peak is in
view from every corner of the map.

## Consequences

- The cost is five extra draws and about 8,000 triangles, with no textures
  and no shadows.
- Trees and hills beyond the fog are drawn in the horizon colour, so against
  the darker ridges they now show as pale shapes, like trees standing in mist.
  From a summit the fogged valley reads as a sea of cloud under the ridges.
- The far country is opt-in per scene (`addDaylight(scene, { skyline: true })`),
  so gallery pictures of single models keep their plain backdrop.
  `/?gallery=skyline` shows it from the lake, the home clearing and the summit;
  add `&time=0.79` for sunset, `&season=winter`, or `&cloud=0.6` for rain.
- Ash Peak has a name but no place on the map or in the journal yet. Place-name
  banners are a later change.
