# 0023. Decorating the garden

**Status:** accepted · **Date:** 2026-09-23

## Context

Chris asked to finish what Phase 3 already promised - build **and decorate**
a cabin - before moving on to Phase 4. The cabin itself (decision 0022)
shipped as a walk-around exterior with nothing yet to decorate it with, so
this was a genuine design fork rather than an implementation detail, and
Chris was asked rather than guessed at:

- **Where:** outside the cabin, using today's build system, rather than
  first making the cabin a space you can walk into - a much bigger project
  on its own.
- **What first:** a flower bed and a lantern - two small props, the same
  "prove the system, then grow it" size as the campfire's own first pass.
- **Cost:** a new resource, rather than reusing logs or making decorating
  free. Flowers, gathered from patches the same way sticks already are.
- **Limits:** one of each per player, the same shape of rule the cabin
  already has.

## Decision

**Flowers are a gather-spot resource, not a pickup.** `GatherSpot` gained an
`item` field so a patch can offer sticks or flowers - the mechanic itself
(never used up, paced by the same swing cooldown, loses to eating nothing
since it is not food) needed no change at all. Two flower patches join the
two stick patches in the hand-built clearing, one a short walk from spawn,
one out by the pond.

**A flower bed costs six flowers, a lantern costs four.** Flowers carry the
same `maxCarry: 10` as everything else stackable, so one full trip pays for
exactly a bed and a lantern together, or two of whichever alone - a cousin
of the cabin's "ten is also the most a pack can hold" reasoning, at a scale
that does not need three felled trees to test.

**The per-player cap had to stop being "already has a home."** The cabin's
`isHome` flag did two jobs at once: capping a player to one, and deciding
where they spawn. A decoration needs the first without the second, and two
different decorations each need their own independent cap - owning a flower
bed should never block a lantern. `BuildableKind` now has both: `isHome`
(spawn behaviour only) and a new `capPerPlayer` (the one-per-kind limit,
true for a cabin, a flower bed and a lantern; false for the communal
campfire). The simulation's ownership map, `ownedBuiltProps`, tracks who
owns which built prop id regardless of kind; a new `ownsBuildable(playerKey,
kind)` checks it against the _specific_ kind being requested, not "any
capped thing at all." `homePositionFor` still only reads it back for an
`isHome` kind, so decorations have no opinion on where anyone spawns.

**Everything else was already generic.** The build menu, its cost display,
the HUD hint listing every buildable, the wire encoding for both the
buildable kind and the inventory count, and the game server's storage of
`owner_key` never mentioned a specific kind anywhere - "content as data"
paid for itself here. Adding two rows to `BUILDABLE_KIND_ORDER` was enough
for the menu to grow from two entries to four with no server code touched.

## Consequences

- A future decoration (or a second home-like building) is another data row:
  `capPerPlayer` for the limit, `isHome` only if it should also be where its
  owner starts.
- The browser test stays modest again, the same trade-off decision 0022
  made: only the cheaper lantern (four flowers) gets a full gather-and-build
  pass in a live browser. The flower bed's cost and the one-of-each-kind cap
  - including a player owning a cabin, a flower bed _and_ a lantern all at
    once - are proven at the shared-simulation layer instead, alongside a
    game-server test confirming a decoration's `owner_key` (not just a
    home's) survives a real reconnect through actual storage.
- Decorating still means placing a shape outside the cabin. Anything
  inside it is still gated on the cabin becoming a real interior space,
  which nobody has asked for yet.
