# 0020. A campfire you can build

**Status:** accepted · **Date:** 2026-09-23

## Context

Phase 3 is "build and decorate a cabin", and Chris was ready to start on it.
Rather than begin with the cabin itself, he chose to prove out placing and
saving something with one small object first - the same way fishing started
with just a pond and a rod, and wildlife started with a rabbit that could
not yet be caught. Asked to choose between a campfire and a storage chest
for that first object, he picked the campfire: a chest also means opening
something and moving items in and out, a second interaction on top of
placement, and this change is about the placement itself. He also settled
placement is aim-and-place anywhere in the clearing, not a fixed spot or a
grid, and that it costs logs - nothing new to gather to try it.

## Decision

**A buildable is content as data**, in `data/buildables.ts`, the same shape
`ANIMAL_KINDS` and `RECIPES` already use. One kind for now: a campfire,
costing four logs - exactly what felling the clearing's landmark oak pays
out, so trying this needs nothing but an axe and one tree.

**Placement is a fixed reach in front of the player**, not a raycast or a
free-form drag: `sim/building.ts`'s `buildSpotFor` works the same way a
chop or a pickup does, just further out. It refuses a spot past the tree
line - building is a clearing thing, not a wilderness one - on the water, or
already sitting on top of something: a tree, a rock, or something already
built. The same function runs on the client to draw the hint and on the
server to decide, the way every other reach check already does.

**Its own button, `B`**, rather than a craft hotkey or the swing/cast
button. Placing something needs an aim check the way chopping and casting
do, so it rides the fixed-step simulation like they do, not a standalone
message like crafting; sharing their button would mean guessing which of
three things a click was for. It shares their short cooldown breather
regardless, the same way gathering already does.

**Told to everybody, the same as a felled tree**: a `BuiltProps` message
carrying the whole list of everything ever built, sent on arrival and again
whenever something new goes up. Cheap while there is not much built yet,
and simplest to keep every browser in sync. No private "you built it"
toast - the campfire appearing exactly where you aimed, and the logs
leaving your pack, already say so.

**Saved in its own table**, `built_props`, keyed by a fresh id nothing else
hands out. Unlike a tree or a pickup, nothing about a built prop comes from
the seed, so there is no untouched state to reconcile against - every row
in the table is simply drawn.

**No collision yet, and no fire.** A placeholder pile of logs over a dark
base, walked through the same way a rabbit currently is. It does nothing
yet beyond standing there - Phase 0's rule still applies: place the
mechanic first, replace the shape once it is fun.

## Consequences

- A second buildable kind will need a way to choose between them, most
  likely a number key the way crafting already picks a recipe - `tryBuild`
  only ever tries a campfire today.
- The spot check only looks at the clearing's own props and other built
  things, never wilderness scenery: building only works inside the
  clearing's own tree line anyway, so nothing out there needs checking.
- The actual cabin is a much bigger, separate decision still to come: a
  structure with more than one piece, that you can walk inside, and that
  has to look the same the next day. This is only the placing-and-saving
  ground it will stand on.
