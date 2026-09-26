# 0042. Hotbar icons, and a way to reset testing

**Status:** accepted · **Date:** 2026-09-26

## Context

Playing the bag-and-hotbar feature (0040) on staging, Chris asked for two
things in the same message: real icons for every item instead of the flat
colour swatches the hotbar has shown since it shipped, and a way to clear
out everybody's saved inventory so testing the new icons starts from a
clean slate rather than carrying over whatever a long testing history had
already put in people's packs.

## Decision

**Ten small flat-shape icons, one per item, built the same way every other
placeholder in this game is.** No new art pipeline, no sourced pack: each
icon is inline SVG made of two or three simple primitives (a rect, an
ellipse, a circle, a polygon), the same "handle and a blade," "stem and a
sphere" idiom already used for the axe pickup and the flower bed. A single
flat fill colour - the item's own `placeholderColor`, exactly what the
swatch already used - keeps a slot reading the same at a glance as it
always has, just as a recognisable outline now instead of a plain square.
Perch, trout and golden carp share one fish shape and differ only in
colour, the same sharing the 3D held-fish placeholders from 0041 already
do. Confirmed by eye before shipping: a static preview page, screenshotted
directly rather than through the game itself, since a flat 2D icon needs
no server, no WebSocket and no rendering pipeline to check - unlike the
3D held-item grips 0036 and 0041 could never get a timely look at in this
sandbox, this was fast, and the first attempt at the meat icon was visibly
wrong (read as a balloon on a string) and revised on the same pass.

**The hotbar's "usable" highlight logic is unchanged** - only the square
swatch became a shaped one, in the same spot, at the same size.

**A second, narrower endpoint resets player data for one world.**
`GET /api/worlds/:worldId/reset-players?confirm=clear-everyone` clears the
`players` and `player_items` tables - every saved pack, hunger, health,
position and name - and `pickups_taken` too, deliberately: leaving that
table alone while wiping packs would make the axe, bag and rod permanently
unfindable, since they would still show as already taken with nobody left
carrying them. That is a correctness requirement, not a scope choice -
"start fresh" has to mean the one-time pickups can be found again, or it is
not actually fresh.

**Everything else about the world is left alone on purpose.** Built props,
tree state and buried caches are not touched - none of those are
"inventory," and wiping them would erase testing history nobody asked to
lose. Trees still bear scars, existing campfires and cabins still stand.

**The confirm query string is a guard against an accidental trigger, not
access control.** A GET is the only realistic way to hand a non-coder a
"visit this once" action with no client to build for it; requiring the
exact value stops a stray link click, a browser prefetch or a crawler from
firing it by accident. Refuses outright while anyone is connected to that
world, rather than racing a live session's own save: `WorldSimulation` is
only ever released (`this.simulation = null`) once the last player leaves
and their state has already been written to storage, so this only ever
runs after that save has happened, never before or during it.

## Consequences

- Ten icons cover every current item; a new item added later needs a
  matching shape added to `item-icons.tsx`, the same way it already needs a
  new row in `ITEM_KINDS`.
- The reset endpoint is deliberately not wired into any menu or button in
  the game itself - visiting the URL once is the whole interface. It is a
  playtesting tool for Chris, not a player-facing feature.
- Verifying this batch hit a snag along the way: a local safety check in
  this environment briefly refused every command touching
  `apps/game-server` or `apps/web`, reading the new `DELETE FROM` SQL
  itself as a mass-deletion risk regardless of what the command actually
  did (a plain typecheck included). The change was reviewed carefully by
  hand in the meantime, against the exact patterns already established
  elsewhere in the same file (`deleteBuriedCache`, `writePlayerItems`,
  `addColumn`). The block cleared on its own on a later attempt: the full
  monorepo typecheck, lint, test suite (668 tests across every package)
  and build all confirmed clean before this shipped.
