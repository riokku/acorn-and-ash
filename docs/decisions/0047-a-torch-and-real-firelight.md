# 0047. A torch to craft, and real firelight for the campfire and lantern

**Status:** accepted · **Date:** 2026-09-26

## Context

Chris asked for night to actually need light: the torch, the lantern and the
campfire should all give off real light, flickering the way fire does.

None of the three did, before this. The campfire has had a real, animated
flame since 0033, but it was only ever a glowing model - nothing it did
brightened anything around it. The lantern (0023) is a placeholder post with
an always-on emissive "glass" block, which reads as lit but, the same as the
old campfire, was never an actual light source. A torch did not exist in the
game at all - no item, no recipe - though `assets/items/wooden-torch.glb`
had been sitting converted and unused since 0034, staged for exactly this.

## Decision

**One shared flicker, not three.** `apps/client/src/scene/fire-light.ts` is a
small helper, `createFlickerLight(color, intensity, distance)`, wrapping a
plain `THREE.PointLight` whose intensity wobbles from two layered sine waves
so it doesn't read as a single metronomic pulse. The campfire, the lantern
and the torch all just place one of these where their fire is and call its
`update` each frame - tuning how fire flickers, generally, now happens in
one place.

**No shadows on any of these lights.** The sun is still the only
shadow-casting light. A world with several players each carrying a torch,
standing near a lantern and a lit campfire could otherwise be paying for a
handful of shadow-casting lights at once for very little visible gain at
this size.

**The campfire's light rides its existing `lit` server state (0033) -
nothing new was added there.** `setLit(true)` now also creates the flicker
light alongside the flame model, positioned where the flame actually is;
`setLit(false)` removes both. It does not wait on the flame model itself
loading, so a fire still lights up its surroundings even in the unlikely
case that the flame glTF fails to fetch.

**The lantern has no on/off state at all - it is always lit once built.**
Chris asked for it to emit light, not for a way to switch it off, and its
placeholder glow was already always on; adding a real light without adding
a switch keeps that the same. This also means no wire format change: unlike
the campfire, a lantern needed nothing added to `BuiltProp` at all, since
nothing about it is server-decided.

**The torch is a new item, not a variant of anything.** Crafted from two
sticks - the same gathered-by-hand, no-tool-needed ingredient the axe's own
first recipe uses, so needing light is never blocked behind a tool a player
doesn't have yet. It equips and shows in the hand the same way the axe and
rod do, reusing the same hand-bone attachment and the axe/rod's own
confirmed grip pose as a first guess for its own - unconfirmed against a
real screenshot the way the axe's grip was (see `character.ts`), so Chris
flagging it from a PR preview if it looks wrong in hand is expected, not a
bug. It is a permanent tool once made, like the axe and rod: no fuel, no
burning down, matching the campfire's own "atmosphere only, no fuel to
track" choice in 0033 rather than inventing a new system this game doesn't
otherwise have. A knockout leaves it alone the same way it leaves the axe,
rod and bag alone - as essential at night as a tool is for gathering.

**Light colour, brightness and reach were picked by eye, not computed.**
Three.js's point lights are physically based (inverse-square falloff), which
doesn't map onto this game's existing light intensities (a hemisphere and a
directional light, neither of which decays with distance) in any way worth
computing by hand. Values were chosen against a screenshot taken at night,
sized so the campfire is the biggest and brightest of the three, the torch
next, and the lantern - a garden light, not a bonfire - the smallest.

## Consequences

- `assets/items/wooden-torch.glb` is now actually used; its `LICENSES.csv`
  note no longer says otherwise.
- `fire-light.ts` is generic, not campfire-specific, and ready for whatever
  the next light-emitting thing in this game turns out to be.
- Night still changes nothing else about how the game plays - no danger
  scaling, no creature behaviour change. This only makes the dark actually
  dark, and gives a player a real reason to have a torch, a lantern or a
  lit campfire before it falls.
- A lit campfire, a built lantern and an equipped torch are now all a little
  more expensive to render than before (one extra point light apiece), which
  is worth watching if a later playtest with many players at once shows it.
