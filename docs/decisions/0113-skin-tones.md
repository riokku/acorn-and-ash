# 0113 · Players pick a skin tone

**Status:** accepted · **Date:** 2026-10-08

## Context

Chris wants players to be able to change their character's skin tone slightly. Each of the six bodies (decision 0112) has its own skin painted into its model: the face into the head's texture, and the arms, legs and feet as vertex colours.

## Decision

Settled with Chris:

- **Five gentle tones:** each body's own skin (**Natural**), two a little lighter (**Lighter**, **Lightest**) and two a little darker (**Darker**, **Darkest**). They live in `SKIN_TONES` in `packages/shared/src/data/characters.ts`. Each is a scale on red, green and blue; darker tones lose more blue than red, so they stay warm.
- **A row of swatches** under the character choice, showing the chosen body's own skin in each tone.
- **Picked once, when the character is made**, like the body itself (decision 0087). It cannot be changed later.

How it works:

- **Only the skin changes.** The art script (`tools/art/plain_bodies.py`) puts every body's skin on a material of its own, marked `skin` in the model: the bare arms, hands, legs and feet, and the faces of each head painted in skin. Hair, eyes, brows, beards and clothes are on other materials, so a tone never touches them. The game multiplies the skin materials' colour by the tone, on top of the player's tint.
- **Saved and shared like the tint.** The browser remembers it with the name and tint. It is sent in `Hello` and in the `Roster` everybody receives (one more byte in each), and the world saves it with the character (`players.skin_index`).
- **Characters made before this keep their own skin.** On the wire and in the database, Natural is 0, which is what every older character reads as.
- **Gallery:** `?gallery=bodies&tones` lines up every body in all five tones, and `&skin=darker` (any tone) gives the bodies on `?gallery=bodies` that skin.

## Consequences

- A new body needs its skin painted in the same skin colours (red near 0.96, as the pack paints it) for the script to find it, and its own skin colour added to `BODY_SKIN` in `apps/client/src/scene/skin-tone.ts` for the swatches.
- Gear does not change with the tone; any skin a piece shows (the Barbarian's outfit is mostly bare chest) stays as the pack painted it. When wearing gear is built, those pieces can get the same skin materials.
- More tones, or wider ones, are new rows in the table: only ever added to the end of `SKIN_TONE_ORDER`.
