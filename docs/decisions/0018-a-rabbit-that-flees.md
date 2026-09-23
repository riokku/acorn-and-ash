# 0018. A rabbit that flees

**Status:** accepted · **Date:** 2026-09-23

## Context

Hunting is the one piece of Phase 2 nothing exists for yet. Chris chose the
real version over two smaller options: a critter that just stands there, or
a trap set and checked later. He wants something that notices you and runs,
so catching it takes an actual chase - and once caught, it is taken with the
axe, the same swing that already fells a tree, rather than a new weapon or a
thrown snare.

That is two changes, not one. Nothing in the game has ever moved on its own
before - trees, fish, sticks, all fixed in place - so a wandering, fleeing
animal is new ground by itself: an AI system, a place for it to live, and a
way for the client to draw something that is not a player. Catching it is a
separate, smaller change once that ground exists, the same way the
wilderness itself shipped before fishing or chopping ever reached into it.
This change is the first half: a rabbit that ambles near its den and bolts
when you get close. It cannot be caught yet.

## Decision

**A rabbit is content as data**, in `packages/shared/data/animals.ts`: how
fast it ambles, how fast it flees, how close startles it, how far it wanders.
One kind for now, the same shape trees and fish already use.

**A few dens, hand-placed in the wilderness**, in `world/animals.ts`, past
the clearing's tree line but close enough not to be a long walk from spawn -
the same reasoning `STICK_PATCHES` used. An id in that list is also the
animal's id on the wire, numbered well past anything a player's own `netId`
would realistically reach, so the two are never mistaken for each other even
though they share the same field.

**Wandering is a fresh point drawn from the world seed**, the same trick
`regrowDueAtMs` uses for a felled tree's timing: hash the seed, this animal's
id and how many wander decisions it has made before. Nothing about a
rabbit's path is stored or sent - only replayed, deterministically, should a
client ever need to. Fleeing needs no randomness at all: straight away from
the nearest player, recomputed every tick so it keeps curving as a chase
closes in, with a wider "calm down" radius than "startle" radius so it does
not flicker right at the edge of noticing you.

**It rides the snapshot every player already gets, not a new message.** A
new flag bit marks an entity as wildlife rather than a player; the position,
velocity and facing fields it needs already exist. The Durable Object's own
code did not have to change at all - `WorldSimulation.step` and
`snapshotFor` already do everything the world server calls.

**The interpolation the client already had for other players is now generic**,
renamed `InterpolatedEntities`: it never actually depended on anything being
a player, only on numbered entities appearing in snapshots. A game keeps one
instance for players and a second for animals rather than teaching either
about the other.

**No collision yet, and nothing is saved.** A rabbit can be walked through
like a placeholder box, because right now it is one. Dens are a fixed list
both ends already agree on, and nothing about wandering or fleeing needs to
outlive the tick it happens on, so - like the wilderness - there is nothing
here worth writing to storage: a world that sleeps and wakes again simply
starts every animal back at its den.

## Consequences

- Catching one - with the axe, per Chris's choice - is the next change, once
  this has been played. It will need a reach check against a moving target,
  an item it gives up, and a respawn.
- A second animal kind will want its kind to travel too, once one exists;
  today the client only ever draws a rabbit because that is the only kind
  there is.
- A rabbit does not yet avoid walking through a tree trunk. Fine for a
  placeholder box; worth a look once it has real art and real collision.
