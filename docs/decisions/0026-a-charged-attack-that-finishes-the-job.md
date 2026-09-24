# 0026. A charged attack that finishes the job

**Status:** accepted · **Date:** 2026-09-23

## Context

The dodge (decision 0025) left one piece of the settled Combat design
unbuilt: "light and charged attacks." Chris picked it as the next Phase 4
slice, with no further steering beyond that - by this point the pattern for
a threat's own wind-up, a dodge's own cooldown-gated commitment, and the
"content as data" numbers behind both were established enough to design the
rest from precedent rather than bring back more questions.

## Decision

**Held, not tapped - right mouse button, a key nothing else in the game
uses.** Left click already means "swing," held for a steady chopping rhythm;
reusing it for two different attacks would have meant guessing whether a
hold was heading for a light swing or a charged one. A second button avoids
the guess entirely, the same reasoning that gave the dodge its own key
rather than overloading Space or Shift.

**Charging roots you to the spot, the same commitment a threat's own
wind-up already asks of it.** `PlayerRuntime` gains `charging` and
`chargeReadyAtMs`; while `charging` is true, every input this tick is
replaced with one that carries the same aim but no movement or other
buttons, so a charging player can still look around but cannot walk,
sprint, jump, swing, dodge or interact until it resolves. This is
server-only - the client makes no attempt to also freeze its own local
prediction, so a player who tries to walk mid-charge sees a brief,
self-correcting mispredict rather than something the server had to get
exactly right on both ends. Small and cheap next to threading a matching
freeze through client-side prediction for a mechanic this short-lived.

**It always finishes the job, whatever that would otherwise take.** A
charged swing that reaches a tree fells it outright, however many ordinary
swings it is worth; one that reaches a threat defeats it outright,
regardless of `hitsToDefeat`. Both `trySwing` and `catchAnimal` take a
`charged` flag that simply skips the "still standing" branch straight to
the same code a final ordinary swing already runs - no new felling or
defeat logic, just an existing outcome reached a different way. The
alternative - a charged hit worth some fixed number of ordinary ones - was
also considered and set aside: at roughly a one-second wind-up against a
0.45 s swing cooldown, anything short of "outright" would have made a
charged attack slower than simply mashing light attacks for the same
result, defeating the point of building it at all. "Outright" instead makes
the trade legible in one sentence: light attacks chip away safely: a
charged attack ends it in one, if you can afford to stand still for it.

**No cancelling once started, and no choosing the exact moment it goes off
either - it fires the instant `CHARGE_SECONDS` (one second) is up,
whatever is or is not in reach right then.** Letting go early does not back
out of it; holding past the mark does not hold it ready and waiting. Both
would have meant tracking a "fully charged, awaiting release" state with
its own new risk of turning the wind-up into a free, no-deadline threat
check - simpler, and just as readable, to make the timer itself the whole
commitment, the same as a threat's own wind-up already is.

**The direction math `stepPlayer` already had is reused, not copied a
second time.** The dodge (decision 0025) already pulled the "turn a held
key and the camera heading into a world direction" logic out of `stepPlayer`
as `worldMoveDirection`; nothing new was needed here since charging only
ever zeroes that input rather than redirecting it.

**A right-click brings the browser's own menu with it, so the canvas now
swallows `contextmenu` while the pointer is locked.** The one bit of
plumbing genuinely new to this feature, since nothing before it used the
right button at all.

**The browser test proves the swing lands, not the fight.** Following
straight from the lesson decisions 0024 and 0025 already paid for: this one
walks to the clearing's own oak, holds right-click, and checks it falls in
one go - no raccoon, no walk into the wilderness, nothing that risks the
minutes-long flakiness a live fight cost twice before. Rooting a player in
place, resolving on a fixed timer regardless of what is in reach, and
always finishing the job outright are all proven quickly and
deterministically by the shared suite instead.

## Consequences

- Every piece of the settled Combat design (light and charged attacks,
  dodge, readable enemy wind-ups) now exists.
- A charged attack against the masked raccoon is meaningfully safer than
  three light swings in open combat - not because it is faster, but because
  it only needs one attack to actually land rather than three, which
  matters most exactly when getting three clean swings in is hard. Worth
  watching once Chris has played it: if it makes the fight too easy, the
  wind-up time or the cooldown afterward are the numbers to move, not the
  "outright" rule itself.
- Holding right-click continuously lets a charge auto-restart the instant
  the last one resolves, with no need to release in between. Against a
  single lingering target that is mostly harmless repetition; chaining it
  across several trees back to back is a mild, but real, logging shortcut
  worth knowing about rather than a design goal.
- No client-side prediction exists for the freeze itself, so a player who
  moves right as their own charge starts will see a small, brief correction
  snap them back. Worth a look if that turns out to feel worse in practice
  than it measured in testing.
