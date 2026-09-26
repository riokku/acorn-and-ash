# 0041. Showing what you have equipped

**Status:** accepted · **Date:** 2026-09-26

## Context

Right after the hotbar shipped (0040), Chris asked for the next obvious
piece: "let's ensure whatever the user has actively equipped appears in the
character's hand," and offered to find whatever models this needed.

Nothing settled so far answered exactly what that meant, so three real
questions went to Chris rather than being guessed at:

- **Which items show in hand?** Chris chose tools plus food - the axe, the
  rod, and every fish or meat - not the materials (logs, sticks, flowers)
  or the bag itself.
- **How is "equipped" chosen?** Not automatic or contextual - a hotbar slot
  becomes the one "selected" item the moment its key is pressed, and stays
  that way until another slot is pressed.
- **Does anyone else see it?** Yes - sent to everyone nearby, not just shown
  locally the way the axe alone was in 0036.

That last answer is the one that made this more than an art pull: 0036's
held axe was local-only, a single hardcoded boolean
(`setHoldingAxe`/`heldAxe`) driven straight off "is the axe in the pack,"
with no idea what anyone else was holding. Making it a real, shared, chosen
state meant server-authoritative state, a wire message, and a client system
that could show any of six items instead of one.

## Decision

**`equippable` is its own flag on `ItemKind`**, not inferred from
`keepOnKnockout` (true for the bag too, for an unrelated reason) or from
being food. True for axe, rod, perch, trout, golden carp and meat; false for
log, stick, flower and bag.

**The server owns what is equipped, the same as everything else it decides.**
`WorldSimulation` gained an `equippedItem` field per connected player,
defaulting on a fresh connect to whichever of `TOOL_ITEMS` (axe first, then
rod) the pack actually holds, or a saved choice if one exists and is still
held. It is never trusted blindly after that: `equippedItemOf` re-checks
`hasItem` on every read rather than being cleared proactively wherever an
item might leave the pack, so eating the last of an equipped fish, or a
knockout burying it away (0028), empties the hand out on its own with
nothing extra to maintain.

**`useItem` grew from "eat food" into "select, and eat too if it's food."**
Pressing a hotbar slot now always tries to equip whatever is shown there -
refusing outright for anything not `equippable` or not actually held - and,
only if it is food and hunger is not already full, eats it the same moment.
Equipping a tool does nothing else; the pack and hunger are untouched.

**A new `Equipped` message carries the whole list, sent whole.** Same shape
as `Roster`, `BuiltProps` and `BuriedCaches`: cheap while a world holds at
most `MAX_PLAYERS_PER_WORLD`, simplest to keep in sync, no per-entry diffing
to get right. Sent to a newly joining player covering everyone already
connected, and again to everyone whenever any one player's choice changes.
Three bytes an entry - a netId and an item index, `NO_ITEM` standing in for
nothing equipped - reusing the same sentinel and index helpers `Inventory`
and `Hunger` already have. An index this build has never heard of decodes as
nothing equipped rather than failing the whole message, the same call
`Hunger` already makes for an unrecognised "what was eaten."

**The held axe's single hardcoded slot became a small per-item table.**
`character.ts`'s `heldAxe`/`setHoldingAxe(boolean)` is now `heldItems`, a
group per equippable item parented onto the same hand bone the axe always
used, all built once and hidden at creation, with `setEquippedItem(item)`
showing at most one. The rod reuses the exact rotation and offset 0036 spent
real effort sampling for the axe (`HELD_AXE_ROTATION`/`HELD_AXE_OFFSET`),
rather than a fresh guess: both are long, one-handed tools whose model sits
base-at-origin (`loadScaledModel` grounds it there), gripped by that same
base end. Nobody has sampled the rod's own grip against a real screenshot
the way the axe's was - this is a first guess, flagged as one in the code,
the same status 0036 shipped the axe's own grip with before it got that
treatment.

**The four food items get a placeholder shape apiece, nobody having modeled
a fish or a cut of meat yet.** One shared body-and-tail shape (a squashed
sphere plus a small flattened cone) stands in for perch, trout and golden
carp alike, tinted by each one's own `placeholderColor` - the same "share
geometry, vary material" idiom the flower bed already uses for its blooms.
Meat gets its own rounded chunk plus a bone end, in the same two-shapes-per-
item spirit. All four share one plain rest pose, since a small round shape
looks fine held at roughly any angle - unlike a tool, there is no wrong end
to expose.

**The hotbar's own highlight grew a second ring.** The existing green
outline (something pressing this slot would do) was tied to `isFood` before
this - now it means `equippable`, since a tool's slot does something too.
A separate, brighter highlight marks whichever slot is the one currently
shown in hand, so which of several usable slots is actually equipped is
visible at a glance rather than only inferable.

**One stale hint line got fixed along the way.** `hungerHint` still said
"Press E to eat," left over from before the hotbar existed - E has picked
up, gathered and dug since 0040, never eaten on its own initiative. Changed
to "Press its hotbar number to eat," found only because this pass was
already rewriting the neighbouring `usable` check in the same function.

## Consequences

- **Only a direct `useItem` call ever tells anyone else.** Eating through
  the interact button's own last-resort fallback (`tryEat`, when nothing
  else claims a press of E) calls the same inventory removal directly and
  never touches `equippedItem` or fires an equip event. If that fallback
  happens to finish off the last of a food item that was also the equipped
  one, every client - including the player's own - keeps showing it in hand
  until that player's next hotbar press corrects it. Rare (needs the
  fallback to specifically finish off the equipped stack, not some other
  one) and cosmetic (never affects what is actually in the pack), so this
  is being written down rather than chased further, the same way 0028
  wrote down its own guest-key gap instead of engineering around it.
- Chopping and casting still check the pack directly (`hasItem(inventory,
  'axe')`/`'rod'`), exactly as before - equipping is cosmetic, not a new
  gate on what you can do. A player could show the rod in hand and still
  swing an axe at a tree from the same pack; the swing animation only
  actually shows if the axe happens to be the equipped, visible one, since
  animating a hidden group achieves nothing.
- Manually choosing which slot an item lands in is still not built (0040's
  own open item) - equipping just picks whichever slot the pack's wire order
  currently puts something in.
- Shared and game-server tests cover the new state machine end to end,
  including a real two-client WebSocket proof that one player's equip choice
  reaches a second, independently-connected client. The client's own
  generalization typechecks, lints and builds clean, and a fresh
  `equipping the axe shows it in your hand, and a nearby player can tell` e2e
  test was written and exercises the whole path through a real browser - but
  actually finishing a run of it hit the same sandbox-specific slowness
  0033 and 0036 already disclosed, worse this time for reasons not fully
  understood (WORLD_HUNGER_EMPTY_SECONDS and WORLD_REGROW_SECONDS are both
  configured far shorter for e2e runs than normal play, so the slow-tick
  warnings this pass logged are not new; whether this specific walk is
  slower than the axe-only walk 0036 timed the same way was not run down).
  The rod's grip and the four food placeholders are therefore unconfirmed by
  eye - first guesses, same as 0036 shipped the axe's grip before Chris's
  own screenshot led to the sampling pass that fixed it.
- Writing this new e2e test surfaced that the existing suite was never
  updated for 0040's bag gate: several tests that pick up the axe, gather a
  stick or fish still expect to do so without ever finding a bag first, and
  would fail for real now that nothing can be carried without one. 0040's
  own consequences section only claims the shared-package and game-server
  suites for that update, and that is exactly what shipped - the
  `e2e/play.spec.ts` file was missed. This pass's own new test finds the
  bag first and was confirmed by reading, not by a completed run; the rest
  of the file was left as found rather than folded into this pass, being a
  separate bug from a separate, already-shipped feature.
