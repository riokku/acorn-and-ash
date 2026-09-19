# 0009. Items, packs and picking things up

**Status:** accepted · **Date:** 2026-09-19

## Context

Phase 1 is "explore and gather", and it ends when you can chop a tree, log out,
come back and find the stump still there. Chopping needs an axe, and crafting
does not arrive until Phase 2, so the first axe has to come from somewhere else.

Chris settled it: you find one in the clearing. He also settled the carry
limit at ten.

## Decision

**Items are a data table.** `packages/shared/data/items.ts` holds every kind of
thing you can carry, with the limit written next to it. Adding a new item is
adding a row.

**The limit is per kind, not a shared bag of slots.** Ten logs, one axe.
Carrying the axe never costs you room for wood, which is what "a carry limit of
ten logs" plainly means, and it keeps the number on the HUD honest.

**Pickups belong to the seeded clearing.** The axe is placed by the same code
that places the trees, so every client already knows where it is. The server
only has to say which pickups are _gone_ — a list of small numbers — rather than
describing the world.

**Only the server hands anything over.** The client shows "Press E" using the
same reach rule the server applies, but it does not take the item or predict
that it will. Two players reaching in the same tick, and one player holding the
button down, both end with exactly one axe handed out once.

**It is written to storage the moment it happens**, not at the next thirty
second save. Finding the axe is not something anybody should have to do twice
because a server restarted.

## Consequences

- The wire gained two messages: what you carry, and which pickups are gone. Both
  are counted with a single byte, so a world cannot have more than 255 pickups
  taken before that has to change. Phase 1 has one.
- A client cannot invent an item: it is told what it holds and nothing else.
- Saved packs are clamped to the current limit when they load, so lowering a
  limit later cannot leave somebody holding more than the rules allow.
- The axe sits at a fixed spot rather than a random one, so it can always be
  found and so a test can always walk to it. Scattering pickups is a later
  change to one function.
- Ten is a number, not a law. It lives in one table row.
