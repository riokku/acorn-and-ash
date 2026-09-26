# 0040. A bag to find, and a hotbar to show for it

**Status:** accepted · **Date:** 2026-09-26

## Context

Chris asked for a combat bar: slots 1-6 along the bottom of the screen,
similar to most other games, that show what you are carrying and let you use
an item straight from the bar. Getting there raised four real design
questions - none of them answered by anything settled so far - so Chris was
asked rather than guessed at:

- **A bag to find:** should carrying anything at all now depend on finding a
  bag first, the same way chopping already depends on finding the axe? Chris
  went further than the smallest option: yes, and it gates everything,
  including the axe itself. The bag is now the very first thing anybody
  finds in the game.
- **Shared capacity:** should the bag also put one limit on how many kinds of
  things you can hold at once? No - decision 0009's per-kind limits (ten
  logs, one axe, carrying one never costs room for the other) stay exactly as
  they are. The bag is a gate, not a new kind of pack.
- **Number keys:** keys 1-4 already meant something - craft an item, or
  (while the build menu was open) pick a buildable. Chris chose the bigger
  option: the hotbar takes over 1-6 for good, and crafting and building move
  behind their own menus, the same shape the build menu already had.
- **Using a slot:** should pressing a hotbar key actually do something, or
  just show what is in the pack? Chris chose functional now: pressing a
  slot's key eats whatever food is there, on the spot.

## Decision

**The bag is an item like any other, not a new kind of state.** `ItemKind`
gained `bag` - a tool, `maxCarry: 1`, `keepOnKnockout: true` the same as the
axe and the rod, so a knockout can never cost you the one thing everything
else you carry depends on. It sits in a fixed spot near where a new player
spawns (`BAG_SPOT`), found the same way the axe and the rod already are.

**Nothing fits without one.** `roomFor` returns zero for every item except
the bag itself when the pack has no bag; `addItem` is built on `roomFor`, so
every way an item enters a pack - a pickup, a gather spot, a felled tree, a
catch, a cast, a craft, digging up your own buried cache - is covered by one
change in one place rather than a check repeated at each call site. The bag
itself is exempt from its own rule, which is how the first one is ever
picked up at all.

**Loading a save does not go through that gate.** `inventoryFromEntries`
clamps each entry to its own carry limit directly, the same clamp a lowered
limit already needed, rather than replaying every entry through `addItem`.
A player who already had things in their pack before this shipped keeps
them - the same choice decision 0016 made for a save from before hunger
existed starting full rather than empty, not a reason to punish somebody for
an old save.

**The hotbar shows the pack in wire order, six slots at a time.** No manual
placement yet: slot order is `ITEM_ORDER`, the same order the pack is always
sent in, so the bar needs nothing new from the server and nothing new to
persist. A slot's key (1-6) uses whatever food is shown there right away,
through a new `UseItemMessage` - two bytes, encoded and dispatched exactly
like `Craft` already is, since neither is aimed at anything or waits for a
tick. Tools and materials show in the bar for visibility; only food does
anything yet.

**Crafting and building both moved behind a menu**, opened and closed with
their own key - `C` for crafting, joining `B` for building - so every number
key means exactly one thing at a time. Opening one closes the other. The
build menu still closes itself after one pick, since placing something
needs a fresh aim; the craft menu stays open, since crafting several things
in a row is common and nothing about it needs re-aiming.

**The HUD's old always-on "Carrying" line is gone**, replaced by the bar
itself; the craft and build option lists move into their own menus rather
than sitting in the corner permanently. The bottom hint gained a line for
finding a bag - it outranks a pickup or gather-spot hint, so pressing E
before finding one never looks like it should have worked.

## Consequences

- Manually choosing which item goes in which slot is not built yet. Wire
  order is a reasonable, honest first version - deterministic and always the
  same across a session - but it is not what Chris asked for outright, and
  is worth a follow-up once this is played with a little.
- Only food is usable from the bar. What a tool or a material's own slot
  should do, if anything, is an open question for later - nothing here
  changes what left-click, E or the build/craft menus already do.
- This touched a wide reach of tests wherever a fixture built a pack
  directly: every shared-package test that called `addItem` to set up a
  scenario now grants a bag first, and the real end-to-end game-server suite
  now finds the bag before finding the axe, gathering a stick, catching a
  fish or fighting a raccoon. A large diff, but a mechanical one - each
  fixture needed exactly one more line.
- `BAG_SPOT` sits a few steps from the spawn point, clear of every other
  pickup and gather spot's own reach. It was not, at first: placed a little
  too close to the nearest stick patch, a player gathering sticks would pick
  up the bag as a side effect rather than finding it on its own. Caught by
  the real end-to-end suite, not by the shared-simulation tests, which never
  place a fresh player anywhere near a real gather spot layout.
