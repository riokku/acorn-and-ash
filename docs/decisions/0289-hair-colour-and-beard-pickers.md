# 0289. Hair colour and beard pickers

**Status:** accepted · **Date:** 2026-11-10

## Context

When the two bodies were remade as faceted dwarves (0288), Chris asked that
players be able to choose a hair colour, and kept the five beards for Body 1.
The models were built ready for both: hair, brows and beards share one
material, and each beard is its own piece. The character screen had no
controls for either, so every Body 1 was red with braids and every Body 2
blonde.

## Decision

- **Seven hair colours in the table, six offered.** `own` is the colour the
  body was modelled with (red for Body 1, blonde for Body 2), then copper,
  wheat, chestnut, coal, silver and snow. Each body is offered its own colour
  first and never the same colour twice, so Body 1 is not shown copper beside
  its own red. Switching body keeps the colour picked.
- **Five beards, for Body 1 only:** braids, long, full, moustache and chops.
  Body 2 has hair only (0288), so the beard row is hidden for it. There is no
  clean-shaven choice; that is a question for Chris.
- **Picked once, like the skin tone.** Both are chosen when the character is
  made, sent with the name, saved by the world and shown to everybody.
- **Old characters keep what they had.** Both are saved as small numbers, and
  0 means the body's own hair and the braids. A character made before this is
  read as 0, and so is a greeting from a browser tab that has not reloaded.
  Both lists only ever grow at the end.
- **A grey copy carries the colour.** The models carry their colour on every
  facet, so another colour cannot simply be multiplied over them: red times
  anything stays reddish. A chosen colour is drawn over a copy of the hair
  whose facets are grey, as light or dark against the hair's own colour as
  they were. The copy is made once for each piece and shared.
- **The tint colours clothes only.** A tint used to colour hair and skin along
  with everything else, which turned silver hair tan under the amber tint.
  Chris settled it: hair is always the colour picked, skin is always the skin
  tone picked, and the tint touches only the clothes.
- **No clean-shaven option.** Chris decided Body 1 always has a beard.

## Consequences

- Hair on every existing character looks a little truer to its picture on the
  character screen, because the tint no longer washes over it.
- Characters already made cannot change hair or beard, the same as their body
  and skin tone: one character per world, fixed when made (0087).
- `?gallery=bodies&hairs` lines up both bodies in every hair colour, and
  `&hair=coal` gives the ordinary line-up that hair.
- Hats and tops are still to be refitted to the new bodies (0288). A helm will
  need to hide or tuck the hair when that is done.
