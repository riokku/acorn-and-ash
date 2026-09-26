# 0045. An item has to be active to use it

**Status:** accepted · **Date:** 2026-09-26

## Context

Chris's ask, in full: "let's ensure that the player needs an item active to
use it. So someone can't fish without the fishing pole active. And they
can't eat a fish without the fish active, etc."

0041 already built the machinery this needed - a server-owned
`equippedItem` per player, chosen by pressing a hotbar slot - but its own
consequences section wrote down, on purpose, that equipping was cosmetic
only: "Chopping and casting still check the pack directly (`hasItem`) ...
equipping is cosmetic, not a new gate on what you can do. A player could
show the rod in hand and still swing an axe at a tree from the same pack."
This closes exactly that gap, for every action 0041 named plus eating,
which never went through `equippedItem` at all until now.

## Decision

**A new `isActiveItem` on `WorldSimulation`** is the one gate everything
below shares: `runtime.equippedItem === item && hasItem(runtime.inventory,
item)`. The `hasItem` half matters for the same reason `equippedItemOf`
already re-checks it on every read - eating the last of an equipped fish,
or a knockout burying an equipped tool away, empties the active slot out on
its own with nothing here having to notice and clear it.

**Swinging, the charge wind-up, and casting now call it instead of
`hasItem` alone.** `trySwing` (which handles both chopping a tree and
catching an animal - a threat included) needs the axe active, not merely
carried. The right-click charge only starts under the same condition.
`tryCast` needs the rod active; the existing "a tree you could chop comes
first" tie-break, which used to defer to a tree whenever an axe was
anywhere in the pack, now only defers when the axe is the *active* item -
otherwise a player with the rod active and an unused axe in their pack
would find casting silently refused near a tree, for a reason 0041 never
intended and the new rule does not want either.

**Eating grew the same gate, in `hunger.ts` rather than `world-sim.ts`.**
`foodToEat(inventory, hunger, equippedItem)` gained a third argument and
lost the `FOOD_ITEMS` scan it used to make: it now returns the active item
if, and only if, it is food and still held. The old "common fish first"
auto-choice is gone with it - there is no longer an automatic pick among
several kinds of food carried at once, only ever the one the hotbar last
selected. `tryEat`, the interact key's own last-resort fallback, now calls
`foodToEat` with `runtime.equippedItem` instead of scanning the pack
itself.

**`useItem` - the hotbar press itself - needed no change.** It already
equips before it eats, so pressing a food's slot both makes it active and
eats it in the same press, satisfying the new rule inherently. That
remains the *only* way to make a food item active without eating it on the
same press, unless hunger is already full - there is no separate "just
equip, don't eat" gesture, the same as 0040 chose.

**The client mirrors the same switch, so hints never promise something the
server would now refuse.** `game.ts` gained `isEquipped(item)` (reading the
server-confirmed `equipped` map) and lost the now-unused `isCarrying` -
the charge-prediction timer, `canCast`, and the axe-vs-cast tie-break all
switched to it. `Hud.tsx`'s chop/catch hint switched from "carrying the
axe" to `state.equippedItem === 'axe'`. The hunger hint now tells the
difference: "Press E to eat" once the active item is already food, "press
its hotbar number to eat" when some other food is carried but not active,
same as before when nothing edible is carried at all.

## Consequences

- Finding a tool or catching a fish still does not equip it on its own -
  0041's rule - but now that also means it does nothing at all until its
  hotbar slot is pressed once. A player who just picked up the axe for the
  first time cannot chop with it a swing early; the hint reflects this
  (it stops offering to chop or catch the moment the axe is not the active
  item, whether or not it is in the pack).
- The "reaches for the common fish first" behaviour `foodToEat` used to
  give the interact key is gone. Eating by any means is now always the one
  deliberate, active choice - never an automatic pick among several kinds.
- This touched tests in all three suites, the same shape 0040 and 0041's
  own consequences sections already described: any fixture that carried a
  tool or food without equipping it needed one more line
  (`equippedItem: '…'` on a saved player, or a `useItem`/hotbar press for a
  live one), not a changed assertion. Explicit tests for the refusal case
  were added at both the shared-simulation layer and, for chopping, a real
  end-to-end game-server test.
- `e2e/play.spec.ts` needed the same mechanical fix everywhere it fetches a
  tool and then uses it, mirroring the pattern the existing "equipping the
  axe" test already used. Most of that file still has the gap 0041's own
  consequences section wrote down and left alone - picking up the axe or
  rod without ever finding the bag first, which the real bag gate from
  0040 already refuses - so those tests do not yet reach the code this
  decision touches. Fixing that is still a separate, already-documented
  problem, not folded into this pass.
- README's "Your character" and "Hunger" sections were updated to describe
  the new requirement rather than the old cosmetic-only one.
