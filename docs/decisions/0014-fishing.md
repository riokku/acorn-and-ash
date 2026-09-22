# 0014. Fishing

**Status:** accepted · **Date:** 2026-09-22

## Context

Fishing opens Phase 2. Chris settled the shape of it: a pond in the home
clearing, a rod you find beside it the way you find the axe, three kinds of
fish with one of them rare, and catching that works like this: cast, watch the
float bob as fish nibble, and click when it goes right under. Too early or too
late and the fish gets away.

That last part is the hard one. The server decides everything, including when
a fish bites, but a click has to be judged against what the player could see.
Word of the bite takes time to reach the browser and the click takes time to
come back, so a window timed on the server gets shorter the slower your
connection. The first version did exactly that, and a playtest on a slow
machine lost every fish.

## Decision

**The window is timed on the player's side.** While a browser shows a bite,
every input it sends carries a flag. The server counts the window from the
first flagged input, in the player's own inputs, which are made at a steady
twenty a second of their own time. One second means one second for everybody,
whatever their connection. A click made before the first flagged input is too
soon, even if it reaches the server after the bite: it was made while the float
was still only nibbling. A browser that never answers loses the fish after
twenty seconds — generous, because a click can only be sent once the browser's
own render loop gets to run, and that loop can stall for several seconds under
nothing worse than a busy machine. A browser test caught this at five seconds:
a busy CI runner lost fish it had clicked on time for, because the stall ate
the whole window before the click could be sent at all.

**The pond is a few overlapping circles,** each a wall the collision code
already understands, kept after the props' own colliders so a felled tree still
finds its stump. Scattered rocks that land in the water are dropped after ids
are handed out, so no tree changes id and saved trees still line up.

**A cast lands as far out as the water allows,** up to five metres ahead, never
closer than a metre and a half and never on the bank. With an axe and a tree in
reach the click chops instead, the same way round on the server and in the HUD.

**What bites is decided when it is hooked,** from the world seed, the cast and
the tick of the click, so no browser can see a rare fish coming.

**Nibbles are decoration.** The browser draws them from who cast and where the
float landed, so everyone watching sees the same ones. Only the big dip is a
bite.

## Consequences

- One more input bit and one more server message: eight bytes, for a cast, a
  bite, a catch or one that got away. Everybody hears about everybody's line.
- A modified browser can hold the flag back to buy itself time, up to the
  twenty seconds. There is nothing to fight over in a pond, so that is an
  acceptable price for fairness to honest players on slow connections.
- Whether a line is biting, and what just happened to it, is pushed to the HUD
  the moment it is known rather than waiting for the next frame. The same
  stall that can delay a click can just as easily swallow a message shown for
  only a few seconds if it is only ever refreshed from inside the render loop,
  which is exactly what the same CI run showed: a caught fish that never
  appeared on screen at all.
- The camera tilts down a little when a line lands. At its usual angle a float
  five metres out sits right behind your own back. Looking up cancels it.
- The pond never runs out, fish cannot be eaten yet, and there is one rod per
  world, like the axe. Eating comes with hunger; more rods come with crafting.
- Someone who joins while you are fishing does not see your float until your
  next cast.
