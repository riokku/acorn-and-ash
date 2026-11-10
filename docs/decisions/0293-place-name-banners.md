# 0293. Place-name banners

**Status:** accepted · **Date:** 2026-11-10

## Context

Chris asked for the world to feel like a big online adventure game, and chose
place-name banners as one of the touches: walk into a place and its name comes
up across the screen. Most of the forest had no names. Asked directly, he
chose:

- the storybook names: Acorn Hollow for the home clearing, Otter Pond,
  Mirrormere for the lake, the Alderwash for the river, the Greywatch Range
  with Old Greywatch along its crest, and Whisper Falls;
- a banner every time you walk in, as Warcraft does it, not only the first;
- banners for regions, landmarks, dangerous places and home;
- a moment of its own for Ash Peak, from the lake.

## Decision

- **One table of places** in `packages/shared/src/data/places.ts`: the two
  regions, the landmarks, the dangerous places (Bonehollow, the King's Road,
  Crownbreaker Hold), home, and Ash Peak as a far-off sight. `whereaboutsAt`
  says which region a point is in and which named spot, if any, it stands on.
  Where spots overlap the smaller or more pressing one wins: the pond inside
  the hollow, a waterfall on the river, the crest on the range.
- **Walking into a region** shows its name large, with the spot you are on
  beneath it. **Walking onto a spot** shows its name alone, smaller. Dangerous
  places are in a warm warning colour and a sight in a pale italic.
- **Not nagging.** A place has to hold for nine-tenths of a second before it
  counts, so skirting a border does not flicker names. A place is not
  announced again until three minutes after you were last in it.
- **Ash Peak** is announced once in a visit to the world, the first time you
  stand at Mirrormere by day in clear air, after the lake's own banner.
- **A soft chime** goes with each banner: rising notes for a place, a low
  falling pair for a dangerous one, one airy note for a sight. It follows the
  sound effects volume.
- **On the map,** Mirrormere, the Alderwash, the Greywatch Range, Old
  Greywatch and Whisper Falls are labelled once that part has been explored.
- **Each player's game does this for itself.** Nothing is saved or sent, and
  no rule reads a place. Arriving in the world announces where you are.

## Consequences

- A banner is words only, with no panel behind it, never takes a click, and
  waits while a raid banner, the king's fight or a menu has the screen.
- Because nothing is saved, there is no "discovered" list and no reward for
  finding a place. Both would need the server to remember what each character
  has found; that is a later change if Chris wants it.
- Old Greywatch is the whole crest of the range, not one peak, because the
  highest point moves with the world's seed.
- The minimap keeps its own line naming the region.
