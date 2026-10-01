# 0061. Patches run out, toasts, and dropping things

**Status:** accepted · **Date:** 2026-10-01

Changes [decision 0017](0017-crafting.md): stick and flower patches no
longer last forever.

## Context

Chris wanted sticks and flowers to feel like things you find, not a tap
that never runs dry. A patch should hold a few, between two and six, and
look emptier as it's picked. He also asked for a clear sign whenever
something goes into the pack, and an easy way to throw things out to make
room, now that the pack counts slots ([decision 0060](0060-a-pack-of-slots.md)).

## Decision

**A patch holds two to six, and moves when it's picked clean.** Each press
of `E` takes one, and the model loses a stick or a flower to match. An
empty patch is gone for three to six minutes, then grows back with a new
count somewhere else in the clearing. It never grows back in the pond, on
a rock or tree, on anything built, within 5 m of the spawn point, or within
reach of another patch or pickup. The count, the wait and the spot all come
from the world seed, so a world always plays out the same way. Patches are
shared by everyone and saved in the world's own database, so an empty one
stays empty across a logout, like a stump. Built flower beds are
decoration, not patches, so they never move. `local` runs and preview links
wait 30 to 60 seconds instead, set by `WORLD_PATCH_REGROW_SECONDS`.

**Right-click a slot to drop or destroy.** Any pack or hotbar slot opens a
small menu: Drop one, Drop all, or Destroy. Destroy asks "Are you sure?"
first. Dropped things land just in front of you in a pile anyone can pick
up with `E`. Dropping more of the same thing nearby adds to that pile. A
pile fades after ten minutes, and a world keeps at most 64. The server
checks every drop: you can only drop what you carry, nothing drops indoors,
and the bag never leaves you, because it holds the extra slots.

**A toast for everything gained.** Whatever goes into the pack (gathered,
picked up, looted, caught or crafted) shows a small card in the bottom
right, such as "+3 Sticks". Repeats add into one card instead of stacking.
Toasts come from comparing each pack update with the last, so every way of
gaining something is covered without the server sending anything new.
Other news stays on the bottom line.

## Consequences

- The server now sends where each patch is and how many are left, and
  every dropped pile. Browsers no longer know patch spots in advance.
- Choices made without asking Chris: dropping is refused indoors, but
  destroying works there. A building placed on a patch moves the patch and
  keeps its count. A pile under a new building is left to fade. Drop and
  destroy news ("Dropped 1 stick.") goes on the bottom line, not a toast.
  Crafting still says "You made a torch." as well as showing a toast.
- Things other than sticks and flowers are drawn as plain coloured lumps
  when dropped, until they get models of their own.
