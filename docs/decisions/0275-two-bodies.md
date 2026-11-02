# Two bodies

## Context

Bodies 1 and 2 were remade in the soft Meshy style (decision 0272) and Bodies
3 to 6 were paused, still faceted dwarves. Chris liked the two soft bodies and
asked to keep only them, with the character screen offering just Body 1 and
Body 2.

## Decision

- **Two bodies to pick from.** The character screen shows Body 1 (the man,
  `knight`) and Body 2 (the woman, `barbarian`). Their beards, skin tones and
  tints work as before.
- **Old characters are switched over, not lost.** Saves and network messages
  store a body as a number. Numbers 2 to 5 (Bodies 3 to 6) now read as Body 1
  for the men (3 and 5) and Body 2 for the women (4 and 6), through
  `SAVED_CHARACTERS` in `packages/shared/src/data/characters.ts`. The old names
  (`mage`, `ranger`, `rogue`, `rogueHooded`) in the browser or an account map
  the same way. The beard, skin tone, items and progress are kept. Numbers 2 to
  5 are never given to a new body; a new one takes number 6 or later.
- **The retired files are deleted:** `mage.glb`, `ranger.glb`, `rogue.glb`,
  `rogueHooded.glb`, their picker portraits (decision 0274) and the faceted
  dwarves' moves, `dwarf.glb`. The
  `dwarf` body shape goes with them; `adventurer` stays as the default for
  the pack's own skeleton. `dwarf-bodies.blend` and `plain-bodies.blend` stay as sources.
- **No clothes pictures in the item editor for now.** It drew clothes on a
  faceted body. The soft bodies are one mesh, so clothes show a short note
  instead of a picture until they are refitted. Weapons and other items still
  show their model.

## Consequences

- About 400 KB less to download: one fewer move library and four fewer bodies.
- Every character in the game now looks soft, but clothes are still not drawn
  on anyone until each piece is refitted to the two bodies.
- A body choice is now a man or a woman. More variety comes from beards, skin
  tones, tints and found gear.
