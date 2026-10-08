# 0113 · Wearing gear: seven slots and the Z character screen

**Status:** accepted · **Date:** 2026-10-08

## Context

Decision 0112 made everyone start in plain clothes and turned outfits into gear to find. This is the part that lets a character put gear on. Chris asked for something like World of Warcraft's: press **Z**, see your character, drag pieces from the pack into slots, and see them on the character in the world, for everyone.

## Decision

Settled with Chris:

- **Seven slots:** helm, upper body, lower body, feet, hands, main hand, off hand.
- **Looks only, for now.** No stats yet. When stats arrive they will change the "gear changes looks only" rule in 0112, and this decision will be updated then.
- **Z opens the character screen** beside the pack: your character in the middle, turning when dragged, a slot on either side.
- **Drag a piece from the pack onto a slot** to wear it. Dragging onto an occupied slot **swaps** the two (the old piece goes back to the pack). Dragging between slots moves or swaps. **Right-click** a pack piece to wear it, and right-click a worn piece to take it off. Dropping a worn piece on the pack also takes it off.
- **No changing gear in a fight.** Gear is refused while swinging, charging, rolling or flinching, for 8 seconds after a blow given or taken, and with a skeleton raider within 14 m. The server decides, and the screen says why.
- **The main hand is what you swing.** A weapon in the main hand is drawn in the hand and used for every attack, unless a tool picked from the hotbar (the axe, say) is out. The knife can go in either hand.
- **Everyone sees it.** The server keeps what each player wears, saves it with the character, and tells everyone connected.
- **Real pieces, for now.** The head pieces are the ones already in the character models (the Knight's helmet, the Mage's hat, the bear hat, the rogue's mask). The body, legs, boots and gloves are a thin coloured skin over the body, and the sword, knife and shield are simple shapes. Chris will make the real art in a Blender session.

Gear pieces are items (`packages/shared/src/data/items.ts`, with a list of slots each can go in), so they live in the pack and use a pack slot each until worn. The rules are in `packages/shared/src/sim/gear.ts` and are tested.

## Consequences

- The head pieces that were drawn into the six character models are hidden, so a head is bare until a helm is worn. This goes a step beyond 0112, which left characters as they were until the art session.
- A full pack can refuse a swap, because the piece taken off needs somewhere to go.
- Gear is saved in its own table, and the pack saves what is carried, so a worn piece is never counted twice.
- Previews can start with one of each piece by adding `?gear=all` to the address. It works only where `WORLD_ALLOW_TEST_GEAR` is `1` (local runs, browser tests and previews, never staging or production).
- Finding gear in the world is still to do, one way per change, as listed in 0112.
