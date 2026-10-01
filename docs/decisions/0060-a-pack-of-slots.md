# 0060. A pack of slots

**Status:** accepted · **Date:** 2026-10-01

Changes [decision 0040](0040-a-bag-to-find-and-a-hotbar.md) in two places:
room is now one shared set of slots, and the bag is no longer needed before
you can carry anything.

## Context

Chris couldn't tell how much room was left in the pack. There was no single
number to show: each kind of thing had its own limit of ten. Two mock-ups
were drawn, and Chris chose the second, one shared bag of slots. Everybody
starts with six slots, and packs found in the world add more. The bag we
have now adds four, for ten in all.

## Decision

**Room is counted in slots, worked out from what you carry.** The pack is
still stored and sent as counts per item, so saving and the network didn't
change. Each item now has a `stackSize`, how many fit in one slot: ten for
anything gathered, one for a tool. Fourteen logs take two slots. A tool
also keeps `maxCarry: 1`, so a second axe never fits however empty the pack
is. `roomFor` is the room left at the top of the item's last stack plus a
full stack per empty slot. Every way into the pack goes through it, as
before.

**A pack adds slots and never takes one.** The bag has `extraSlots: 4`. It
can always be picked up, even into a full pack. If you carry more than one
kind of pack, only the biggest counts (you wear one on your back). Chris
confirmed this, so a second pack is an upgrade, not an add-on.

**The bag is no longer a gate.** Six slots come before any bag. The bag is
still kept through a knockout, so the four slots it adds never vanish.

**Crafting checks room after spending.** Two sticks used up can free the
very slot a torch goes into (`canCraft`).

**On screen:**

- A bag button sits at the end of the hotbar. Its ring has one segment per
  slot and reads "4/6". The old corner button is gone.
- The open pack shows a meter, one square per slot (filled ones with their
  stack, empty ones dashed), and a line on what the bag adds.
- The bag is left out of the numbered hotbar slots, since it has its own
  button.
- The hint along the bottom says when the pack is full, or when you already
  carry the one of something you can only carry one of.

## Consequences

- A save from before this, or one fuller than its slots, keeps everything.
  Loading only clamps to an item's own limit, the same choice decision 0040
  made. That pack just takes nothing more until a slot frees up.
- Digging up a buried stash still drops whatever no longer fits. It's rare,
  since a stash usually tops up stacks you already have, but a pack filled
  up after a knockout can now lose some of it.
- More slots, or more kinds of pack, are now just a row in the item table.
