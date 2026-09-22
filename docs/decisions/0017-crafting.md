# 0017. Crafting

**Status:** accepted · **Date:** 2026-09-22

## Context

The fishing decision left a note for later: "there is one rod per world, like
the axe... more rods come with crafting." Chris asked to start crafting with
three things: a fishing rod, an axe, and a small hut.

The rod is easy: by the time a second one is worth making, chopping has
already put logs in the pack. The axe is not. Logs are the only material in
the game, and the only way to get a log is to chop a tree, which needs an
axe. A recipe that only spent logs could never make a player's first axe -
and since the axe in the stump is a single, fixed pickup, that is exactly the
player who needs one: a brand new one, or a second player in a world where
somebody already found the one axe. Chris settled it: add a material anybody
can gather by hand, no tool needed, the same way the axe pickup itself needs
nothing to take.

The hut is a different kind of thing. The rod and the axe are recipes: spend
some items, get an item back in your pack. A hut gets placed in the world,
has to block movement, and has to still be there tomorrow - closer to "build
and decorate a cabin," which the roadmap already treats as its own later
phase. Chris settled that too: ship the rod and the axe now, in one small
pull request, and figure out the hut's placement, size and saving separately.

## Decision

**Sticks are gathered by hand, from a couple of fixed patches of fallen
branches in the clearing.** Pressing `E` near one adds a stick to the pack,
the same reach rule as a pickup. Unlike a pickup, a patch is never used up -
there is nothing to mark as taken, so two players can draw from the same one
at once. What stops it being spammed is the same cooldown a swing of the axe
already uses: holding the button gathers at a steady rate, not once a tick.

**A recipe table, keyed by the item it makes.** `packages/shared/data/
recipes.ts` holds what each craftable item costs, the same shape as the item
and prop tables: content lives in data, not scattered through code. The axe
costs three sticks; the fishing rod costs two logs. Numbers in one table row,
easy to tune once this has been played.

**Crafting is its own small message, not a button on the input bundle.**
Chopping and picking things up are judged against where you are and which
way you are facing, so they ride the fixed-step simulation the same as
movement. Crafting only cares about what is in the pack, so it needs neither,
and is settled the moment the server reads the message rather than waiting
for the next tick.

**The axe and the rod in the world do not go away.** Finding the axe in the
stump and the rod on the bank are untouched; crafting is an additional way to
get one, not a replacement. A player who already has an axe cannot craft a
second - the recipe checks there is room in the pack before it spends
anything, so materials are never lost to a craft that could not be carried.

**The HUD lists both recipes plainly**, with what each one costs and whether
the pack can currently afford it, and a number key (`1` for the axe, `2` for
the rod) sends the request. No menu, no mouse: pointer lock stays on, the
same as every other action in the game.

## Consequences

- One more item in the table (`stick`), one more small message each way
  (asking to craft, and being told what was made), and a private toast the
  same shape as the one hunger already shows.
- Gathering reuses the swing/cast cooldown field on the player rather than
  adding a new one: after chopping, casting or gathering, all three share the
  same short breather.
- The first server implementation gathered a stick into the pack correctly
  but never told the client - nothing marks a gather spot "taken" the way a
  pickup does, so nothing was queuing an inventory update for it. Caught by
  the game-server test, which talks to the server the way a real browser
  does, rather than only the simulation's own unit tests, which call
  `inventoryOf` directly and would not have noticed a message never being
  sent. Fixed by giving gathering the same "tell the pack changed" event
  every other way the pack changes already has.
- The hut - and building in general - is a separate, later decision.
