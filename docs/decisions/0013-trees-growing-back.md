# 0013. Trees growing back

**Status:** accepted · **Date:** 2026-09-20

## Context

A clearing you can chop is a clearing you can strip bare. Chris asked for trees
to come back on their own, "at least thirty minutes", with the size and the wait
both somewhat random, and for a returning tree to pop back whole rather than
sprout from a sapling.

The awkward part is that a world with nobody in it does not run. It stops its
tick loop the moment the last player leaves, precisely so it can hibernate and
cost nothing. A tree felled before bed still has to be standing by morning.

## Decision

**Count in real time, not in ticks.** Each felled tree records the wall-clock
moment it came down. When a world wakes, everything whose time has passed comes
back at once, before the first word goes out to anybody. Nothing is counted
while the world sleeps, because nothing is running to do the counting.

**Work the numbers out from the seed, and send only a generation count.** How
long a tree takes and how big it comes back are drawn from the world seed, the
tree's id and the number of times that spot has grown back. The server and every
browser reach the same answers on their own, so the only thing on the wire is a
single byte saying which turn this tree is on.

**The wait is between the shortest wait and twice it**, and the shortest is half
an hour in the real game. The environment can turn it down: local runs and
preview links use two minutes, so regrowth can be watched instead of waited out.
It is only honoured when it is a sensible positive number, so a typo in a
dashboard cannot make the forest flicker.

**A tree that comes back is a new tree.** It keeps the spot and the rotation, and
takes a new size between 0.8 and 1.35. The draw that picks the size is separate
from the one that picks the wait, so the tree that took longest is not always
the biggest.

**A tree waits for its spot to be free.** Nobody within a metre and a half of the
trunk, or it tries again next tick. A tree appearing around somebody would be a
nasty surprise, and jumping does not count as getting out of the way.

**Existing worlds are upgraded, not replaced.** The tree table gains its two new
columns when a world that predates this change wakes up, and a stump recorded
before the change counts as having just been cut, so an old clearing heals over
the next half hour rather than popping back all at once the moment somebody
walks in.

## Consequences

- The wire message for trees now carries state rather than a list: id,
  generation and a felled flag, four bytes each. It replaces the "these are
  down" list, because "this one is back, and it is the second to stand here" is
  not something a list of ids can say.
- One byte of generation caps a spot at 255 trees. At half an hour a piece that
  is about five days of chopping the same stump, and the cap is enforced rather
  than wrapped.
- Regrowth is checked every tick, which is 20 times a second for a handful of
  felled trees. If a clearing ever holds thousands of stumps this wants a queue
  ordered by due time instead of a scan.
- Trees are the first thing in the game that happens on real time rather than on
  ticks. Hunger, crops and anything else that should move while you are away can
  follow the same shape: store the moment, work out the rest on waking.
- The client has to be told a tree's generation before it can draw it, because
  the size comes from the generation. A browser that joins mid-regrowth gets the
  full picture in the opening message rather than a stream of changes.
