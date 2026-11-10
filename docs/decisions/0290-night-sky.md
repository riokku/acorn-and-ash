# 0290 — Stars, the Milky Way and a moon in the night sky

## Context

Night was a flat dark-blue sky. The far ridges and Ash Peak (decision 0286)
gave the day something to look at, but after dark there was nothing overhead,
and the "moonlight" on the ground came from no visible moon.

## Decision

- **Stars.** About 900 scattered stars plus about 1,500 fainter ones crowded
  into a Milky Way band. Each is a small diamond, to sit with the faceted
  trees and rocks. A few are bright, most are faint, and some are slightly
  blue or amber. They shimmer gently.
- **Everyone sees the same sky.** The stars are placed from the same seed as
  the far skyline, which today is the same in every world. It is scenery
  only: the server knows nothing about it.
- **The sky turns.** The whole star field turns once a day about a pole star
  due north, 47 degrees up, so the stars wheel slowly through the night.
- **A full moon every night.** It rises in the east at dusk, stands highest in
  the south at midnight and sets in the west at dawn, opposite the sun. It is
  drawn about six times its real size, with three darker patches and a soft
  glow round it. No phases yet.
- **Weather hides it.** Stars and moon use the same "how clear is the far
  country" measure as the ridges, so rain cloud, blizzards and going
  underground hide them. They fade near the horizon and pass behind the
  ridges and Ash Peak.
- **Drawn in code, not Blender.** These are points of light and a plain disc,
  like the sky dome they hang in, not a modelled asset.

## Consequences

- Nights have something to look at and a way to tell the hour and find north.
- The light on the ground still comes from the old fixed "sun doubling as
  moonlight"; it does not yet follow the visible moon across the sky.
- No moon phases, shooting stars or northern lights. Each would be a small
  follow-up if Chris wants them.
- One extra draw for the stars and two for the moon; nothing is drawn by day.
- The gallery (`?gallery=skyline`) gained two views that look up: "Stars over
  Ash Peak" (`&view=stars`) and "Moon over the lake" (`&view=moon`).
