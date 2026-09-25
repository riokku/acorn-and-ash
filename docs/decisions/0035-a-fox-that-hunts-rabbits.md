# 0035. A fox that hunts rabbits

**Status:** accepted · **Date:** 2026-09-25

## Context

Chris asked for a fox: something that "will sometimes chase the bunnies and
can be hunted by the player." Every animal so far has been either prey (a
rabbit, only ever fleeing) or a threat (a masked raccoon, only ever fighting
back) - nothing has ever preyed on something else in this world. A fox is
both at once: prey to the player, exactly like a rabbit, and a predator to
another animal.

The pack Chris sent has the fox fully rigged, with an idle and eleven other
animations. This client has no skeletal-animation playback yet - the
campfire's flame (0033) is still the only animated thing it can draw, and
that's a simpler mesh-and-clip setup than a skinned character. Building
that capability just for the fox was out of scope for a creature that is
still, gameplay-wise, a placeholder-shaped experiment.

## Decision

**A fox flees the player like any other prey, and separately hunts rabbits
on its own.** Two small, optional fields on `AnimalKind` - `preysOn` and its
detection radius and chase speed - describe what it hunts and how eagerly.
Nothing about `maskedRaccoon` or `rabbit` changed shape; they simply leave
those fields unset.

**Fleeing the player always wins.** A fox mid-chase that gets spooked by a
player runs like a rabbit would, not finishing the catch. There is one
engaged/fleeing state, shared with every other prey animal, checked before
the hunt ever gets a turn - simpler than two competing state machines, and
it matches how a real animal would actually behave: startled first, hungry
second.

**A hunted animal is caught the same way a player's catch already works**:
set `caught`, set a respawn timer, done. No new event, because nothing needs
telling a player about something that happened off in the wilderness with
no one watching. **Fleeing now weighs the nearer of two threats**: a rabbit
compares the closest player against the closest thing that hunts rabbits,
and runs from whichever is closer - the same `shouldFlee`/`fleeDirection`
math as always, just no longer assuming a player is the only thing worth
running from.

**The fox's own den sits far from every rabbit den** - deliberately, so a
real chase only happens when both wander there on their own, a rare
"sometimes" rather than a certainty the moment the world wakes up. That
realism made it impractical to trigger a chase inside a fast unit test by
waiting for natural wandering, so `WorldSimulation` gained `placeAnimal`, a
test-only teleport mirroring `placePlayer`.

**Shipped as a static model, animation later.** Rather than build skeletal
playback now, the rigged fox's Idle pose was baked into a plain static mesh
in Blender (pose the armature, apply it into the mesh, drop the armature)
and exported like any other static model. It stands still-postured instead
of animating, the same "placeholder now, better later" sequencing 0033 used
for the flame before the mechanic around it existed.

## Consequences

- A fox cannot hurt a player - it has no `threat` behavior, only `preysOn`.
  Consistent with "creatures first, no PvP," but worth remembering if Chris
  ever wants a fox to also be dangerous: that would need a `threat` block
  added alongside `preysOn`, and a decision about which one wins.
- The eleven other animations that shipped in the same download - walk,
  run, eat, and the rest - are unused. Real skeletal playback, whenever it
  exists, could give the fox (and anything else pulled from this pack)
  actual motion instead of a fixed pose.
- Any future predator (or a second thing a fox itself fears) reuses these
  same three fields rather than a new mechanic.
