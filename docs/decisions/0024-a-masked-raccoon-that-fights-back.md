# 0024. A masked raccoon that fights back

**Status:** accepted · **Date:** 2026-09-23

## Context

Chris greenlit Phase 4 - danger - as soon as decorating (decision 0023)
shipped. Nothing about combat, threats or getting hurt exists yet, so this
was too big to just start building: I brought seven questions back to him,
each grounded in what the code actually does today rather than a guess.

- **What a hit costs:** a new health meter, separate from hunger, rather
  than hunger itself doing double duty.
- **Which creature first:** the masked raccoon, over a goblin.
- **When it threatens:** any time of day. There is no day/night cycle wired
  up yet - `DAY_LENGTH_SECONDS` exists as a constant and nothing reads it -
  so gating on night was not actually available as an option today.
- **What "wakes in their bed" means:** reuse the cabin's existing
  spawn-at-home rule from decision 0022 - your cabin if you have one, the
  shared clearing if you do not - rather than a literal bed object nobody
  has designed yet.
- **How it behaves:** it notices you and comes after you, rather than
  standing its ground.
- **How much combat to build:** a light attack only, reusing the exact swing
  a tree already takes. The settled design also calls for a charged attack
  and a dodge; both are deliberately deferred.
- **What a knockout costs:** just the walk back, for now. Buried items - the
  other half of the settled knockout design - are deferred too.

That scopes the whole slice down to one sentence: a masked raccoon that can
knock you out, and you can fight it off with the axe.

## Decision

**Health is its own meter**, `HEALTH_MAX = 100` next to `HUNGER_MAX`, but
with none of hunger's cozy-light framing - this is Phase 4's first real
consequence. It never runs down on its own; only a threat's landed hit
touches it. `PersistedPlayer.health` is optional, the same way decision
0022 made `playerKey` a trailing optional argument, so none of the existing
save-file test fixtures needed to change.

**A threat is content as data, same as everything else here.** `AnimalKind`
gained an optional `threat?: ThreatBehavior` - chase speed, attack radius,
how long it winds up, how long it waits between swings, damage, and hits to
defeat. It is present only on a hostile kind; its mere presence, not a
separate flag, is what a hostile animal is. The masked raccoon is the first
row to set it: chase speed splits the difference between a player's walk
and sprint (a real threat, but always outrunnable), and its attack radius
is exactly `CHOP_REACH` - the same reach a player's own swing has, so
whoever is close enough to hit is also close enough to be hit.

**The wind-up is real stillness, not a new message.** A hostile animal
freezes - velocity zeroed - for `windupSeconds` before it swings. Every
client already interpolates other entities' positions, so a telegraphed
attack is just an animal that stops moving; nothing needed to go on the
wire to make it readable. Whether the swing lands is decided by rechecking
distance the instant the freeze ends, so backing out of range during the
wind-up is what avoids it - the only dodge that exists until decision work
gives us a real one.

**Defeating one takes multiple hits**, the same shape chopping a tree
already has (`swingsToFell` there, `hitsToDefeat` here). A landed,
non-final swing broadcasts `ThreatHit { animalId, hitsLeft }`, mirroring
how a tree broadcasts its own hit count, including re-announcing a fresh
count when the animal respawns so nobody's client is left showing a stale
number. A defeated threat can pay out nothing - the raccoon does - so
`AnimalCaught.item` is now `ItemId | null` on the wire, reusing the same
sentinel byte hunger already used for "nothing eaten," renamed from
`NO_ITEM_EATEN` to the more general `NO_ITEM`.

**A knockout is a teleport-and-heal, not a state you can observe at zero.**
The instant damage would take health to or past empty, the player is moved
to `wakePosition` - their home if they have one, the shared spawn if not -
and healed straight back to full, all in the same tick. The `HealthEvent`
that goes out always carries the post-heal number; nothing downstream ever
has to handle "health is 0."

**The teleport reuses `placePlayer`, the method the cabin's own
spawn-at-home already calls, rather than writing position fields by hand.**
The first version of this did the obvious-looking thing - read the
player's `Position` component and mutate its fields - and it silently did
nothing: Koota only hands back a live, write-through reference to a
component from inside a query's own `updateEach`, not from a plain `.get()`
elsewhere. The fix was to stop fighting that and call the same `.set()`
based method the codebase already had for exactly this. Worth remembering
on anything that repositions an entity from outside its own query loop.

**Everything about being chased or attacked reuses the rabbit's own
machinery.** The "noticed you" hysteresis a fleeing rabbit already used -
a wider "calm down" radius than "startle" radius, so it does not flicker at
the edge - is the same check a raccoon uses to start closing in instead of
running. The internal field it reads was renamed from `fleeing` to
`engaged` to say what it now means for both. Ambling near the den while
calm was pulled out into one shared `wanderStep`, since prey and an
unprovoked threat do exactly the same thing while left alone.

## Consequences

- Charged attacks and a dodge are still to come, per Chris's own call to
  keep this slice small; right now backing away during the wind-up is the
  only way to avoid a hit.
- Buried items after a knockout are deferred too - right now the only cost
  is the walk back from home or the clearing.
- A second threat kind reuses everything here as-is: another data row with
  its own `threat` block, nothing else to touch.
- No day/night cycle exists yet, so the raccoon threatens at any hour. Once
  a cycle exists, gating threats to night is a data change, not a new
  system.
- The `.get()`-versus-`.set()` gap in Koota that caused the silent teleport
  bug is easy to hit again anywhere code reaches for a component outside a
  query loop and expects to write through it. Worth a second look if a
  future change to a player or animal's position quietly does nothing.
