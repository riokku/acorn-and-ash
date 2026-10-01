# 0056. Moves with weight

**Status:** accepted · **Date:** 2026-09-28

## Context

Chris asked for real animations for combat, light and strong attacks with
whatever is in hand (even an axe or a fishing rod), and for sitting and lying
down at home. Asked directly, Chris chose: KayKit's Character Animations pack
(CC0, which Chris uploaded); feet planted for light attacks; a three-hit combo;
anything in hand can attack, and at the pond the rod casts (the water
decides); "punchy but cozy" impact: a pause on the hit, chips and fur, a
flinch and a trail; plus a hit reaction, knockout, dodge roll, chopping,
casting and reeling, picking up, eating, digging and getting out of bed.
All of it in one pull request.

Until now a swing was an instant server check with no shape to it in time,
so an animation could only guess when it landed.

## Decision

**Every move is a small state machine in the shared rules** (`sim/actions.ts`,
timings in `data/moves.ts`), stepped once per input by the server and by
your own browser alike: idle, swing (1–3), charge, strike, dodge, flinch,
knocked out, rise, sit and lie. Blows land on a set tick of the move, not
the click. The combo lands at 0.2 s, 0.2 s and 0.25 s in. A press during a
swing queues the next one, and walking after the swing is planted cancels
it. Holding for a second winds up a strike that goes off by itself and
lands 0.3 s later, finishing a tree or a fight. Ctrl rolls 4 m, and you're untouchable for
the first 0.35 s, timed on the server's own clock. A hit you take makes you
flinch, which a dodge gets you out of. A knockout lies you down for 2 s
before you wake at home and get up.

**Your browser predicts your moves** the way it already predicts walking,
and adopts the server's move (three new bytes per player in each snapshot)
when they disagree. Hits on animals look back through their last half-second
of positions, so a rabbit that ran as your blow landed on your screen is
still caught.

**The pack's 34 clips go into one shared 352 KB library**
(`tools/import-animations.mjs`). Each move is timed so its blow in the
animation lands exactly on the rules' tick. The animator blends everything
by hand, arms separately from legs, so you can eat, pick things up or fish
while walking. The pack has no clip that brings a hand up to these
characters' big heads, so eating steers the arm to the mouth each frame.
Other players see gestures through a new `Gestures` message.

**Impact:** a short hit-stop and camera kick; chips, fur or dust; the struck
tree shivers and the animal jolts back; a pale streak follows the weapon;
and a whoosh made on the spot from filtered noise, with no audio file.

**Sitting and lying:** E beside the chair or bed settles you in (food in hand
while hungry is eaten first). You stay where you stood as far as the rules go,
and only your model moves onto the seat or mattress. Moving or E gets you up.

## Consequences

- `?gallery=moves` plays every move, and `?gallery=home&resting` shows the
  chair and bed in use, for checking them over.
- Remote players' charged strikes don't throw up dust yet, and only your own
  swings whoosh.
- The rod is held the pack's way, upright while waiting for a bite.
