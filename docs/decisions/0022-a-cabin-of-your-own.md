# 0022. A cabin of your own

**Status:** accepted · **Date:** 2026-09-23

## Context

The campfire (decision 0020) proved out placing and saving something. Chris
was ready to move on to the cabin itself - Phase 3's actual name - and asked
me to also make it where a player starts, inviting questions rather than
guessing. Four came back:

- **Spawn point:** yes, once you have a cabin, that is where you start
  instead of the open clearing.
- **Ownership:** each player gets their own, not one shared cabin the way
  the campfire is.
- **Shape:** one placed exterior shape for now, walked around rather than
  into - matching how the campfire itself started as one simple object.
- **Cost:** logs only, a lot more of them than the campfire's four.

A fifth question came up while building it: with two things to place now,
how does a player choose between them? Chris picked a small menu - press B,
then a number - the same way the numbered crafting list already works,
rather than a second dedicated key.

## Decision

**A cabin is a buildable with `isHome: true`**, a new field on
`BuildableKind` that a campfire does not set. It costs ten logs - the most a
pack can ever hold at once (`log`'s own `maxCarry`), so this is as much as a
single recipe could ever ask for without becoming impossible to pay. It has
a bigger footprint (3m against the campfire's 0.6m) and its own placeholder:
a box with a four-sided pyramid roof, big enough to read as a building
rather than a prop.

**Ownership needed the simulation to know who is playing**, not only which
connection slot they are in. `packages/shared`'s `WorldSimulation` gained a
`playerKey` alongside the `netId` it already tracked - the same stable key
the game server already used for saving position and inventory, just never
threaded through before. `addPlayer` takes it as a third, optional
argument, so none of the hundred-odd existing test call sites needed to
change. A player who already owns a home is refused a second one; a guest
with no key (nothing to remember them by) is never capped, the same way a
guest's inventory already does not survive a reconnect.

**Owning a home changes where you spawn.** `addPlayer` now checks for an
existing home before falling back to today's rules: a fixed point just
outside its footprint, always the same spot, since it is yours alone and
nothing needs spreading out the way fresh arrivals at the shared clearing
spawn do. Someone with no home yet keeps exactly the behaviour they always
had - a fresh player at the ring-spread spawn, a returning one wherever they
last stood.

**Ownership never reaches the wire.** `BuiltProp`, the shape sent to every
client, is unchanged - id, kind, x, z. Nothing about the client needs to
know whose cabin is whose to draw it. The owner lives only in a private
`Map` inside the simulation and a new `owner_key` column in `built_props`,
read back on wake the same way everything else in that table already is.

**Building itself stopped being a held button.** The campfire used `B` as a
bit on the per-tick input, edge-detected the way a swing is. Picking between
two things needs a menu first, so `B` on the client now only opens or closes
that menu - a HUD row exactly like the crafting list's, sharing its digit
keys and taking them over while it is open. A pick sends a small message,
`{ type: 'build', kind }`, mirroring how crafting already works: settled on
the very next tick using whatever position and aim that tick already has,
rather than the held/clicked bookkeeping the button needed. That
bookkeeping - and the button itself - is gone; a discrete request has no
"held" state to confuse with a fresh press.

**Scope held at the exterior shape and the spawn tie-in.** Decorating and an
actual walkable interior are still separate, later work, exactly as flagged
when the campfire shipped. The browser test proving all this end to end
also stayed modest: gathering the ten logs for a cabin means at least three
separate trees in this clearing (no single tree gives more than four), each
taking real minutes to fell in a live browser - on top of the felled-oak
flow the campfire test already exercises. Given the ownership, cost-cap and
spawn-position rules already have dedicated coverage in the shared and
game-server test suites (six new tests between them), the browser test adds
a narrower, faster check instead: with the campfire's own four logs on
hand, opening the new menu shows both prices, picking the unaffordable
cabin does nothing, and picking the campfire still works exactly as before.

## Consequences

- The one-per-player cap and the spawn-at-home rule both depend on
  `playerKey` being threaded correctly wherever a player enters or re-enters
  a world - anywhere that is missed silently falls back to guest behaviour
  (buildable, but never remembered), rather than failing loudly.
- A third buildable kind reuses everything here as-is: another row in
  `BUILDABLE_KINDS`, another menu slot, `isHome` set or not depending on
  whether it should be capped and spawn-worthy.
- No browser test yet proves a cabin surviving a reconnect or becoming a
  real spawn point end to end in a live client - only that the menu offers
  and gates it correctly. The shared and game-server suites cover the rest.
  Worth a full browser pass once there is a faster way to gather ten logs
  than felling three trees by hand, or once Chris has playtested it enough
  to say the mechanic is worth that time.
