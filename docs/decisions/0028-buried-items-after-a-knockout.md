# 0028. Buried items after a knockout

**Status:** accepted · **Date:** 2026-09-24

## Context

The other half of the settled Knockout design, deferred by decision 0024
when the masked raccoon shipped: "the player wakes in their bed, and some
items are buried somewhere in the world, for the player to find." Chris
asked for this alongside the day/night cycle; that one needed no design
questions, this one did, since it decides how much a knockout actually
costs and how fair finding your things again feels. He answered two:

- **What gets buried:** half of what you are carrying, tools aside -
  rounded in your favour, so you always keep the larger share.
- **How you find it again:** a mound where you fell, plus a HUD hint once
  you are close, the same as any other pickup.

Everything else below is reasoned from those two answers and from how the
rest of the game already handles similar problems, the same as decision
0026 did for the charged attack.

## Decision

**Which items count as tools lives on the item itself.** `ItemKind` gained
`keepOnKnockout`, true only for the axe and the rod. `buryHalf` in the new
`packages/shared/src/sim/burying.ts` reads it rather than a hard-coded list,
so a future tool added to the item table is safe by default without anyone
having to remember this rule exists.

**Half is worked out per kind, not across the whole pack.** Seven logs
leaves four in the pack and buries three - floor for what is taken, so the
player always keeps the ceiling. A single log, or any stack of one, buries
nothing: half of one is worth arguing about, so it does not happen.

**A cache is owned by a stable key, not a network id.** The same problem
decision 0022's cabin already solved: a network id only lasts one
connection, and a cache has to survive its owner reconnecting - or the
whole world sleeping and waking again, since it is fully persisted - to be
worth having at all. `BuriedCache.ownerPlayerKey` is that stable key;
`buriedCachesList()` resolves each one's _current_ network id fresh, every
time it is sent, by scanning connected players for a match. A guest with no
key (null, the same way a home built by one has no owner) can knock
themselves out same as anyone, but nobody - not even that same guest,
moments later - can ever dig what falls out back up. Worth knowing if that
ever looks like a bug: it is the one deliberate gap this design leaves.

**The mound is a real object in the shared world; only the dig is
private.** Every client is told where every cache is and who is digging it
up - reusing the network id everyone's position already reveals costs
nothing further to make public - but `tryDigUpCache` only succeeds for the
one player whose stable key matches. Standing on somebody else's mound
does nothing: no hint lights up, and a press of E is silently ignored, the
same as a swing with no axe already is.

**Nothing about what is in a cache goes over the wire.** The HUD only ever
needs to know a cache is there and whether it is yours; what it holds is
revealed by what shows up in the pack once it is dug up, the same as a
felled tree does not say in advance how many logs it is worth. Skipping it
kept the wire format a fixed number of bytes a cache, the same shape every
other list here already uses (`BuiltProps`, `TreeStates`), instead of
becoming the first thing in this protocol with a variable-length list
nested inside another.

**Digging back up reuses the interact button**, tried after a pickup and a
gather spot and before falling back to eating - the same "closest, most
specific thing first" order that chain already followed. A knockout's own
news ("Knocked out! Some of what you carried is buried where you fell.")
almost always loses to the plainer "Knocked out! You wake up safe." from
decision 0024, since both land the same tick and only one line shows at
once; digging one up has the toast to itself, since nothing else is
competing for it that moment.

**No browser test proves the knockout-to-dig-up loop end to end.** The same
call decision 0024 already made for defeating a raccoon, for the same
reason: reaching a real knockout takes four real hits at over two seconds
apiece, adding real minutes for no more confidence than a deterministic
test already gives instantly. The shared suite proves the whole loop -
burying the right half, tools exempt, ownership, reach, and a full
persistence round trip - with a synthetic clock. A new game-server test
plays out one real fight against the real raccoon, through real Durable
Object storage: a cache survives a reconnect, and digging it up deletes it
from storage rather than only from that session's memory. Between the two,
every part of this has been proven against something real except the pixels
themselves.

## Consequences

- A cache does not expire. Left forever, it sits forever - fine for a first
  slice, but worth revisiting if abandoned mounds start cluttering a long-
  lived world.
- A guest with no stable key can lose things to a knockout they can never
  recover, even in the same session. Nothing about play stops them playing
  on regardless; it just means their next haul is the only one that matters.
- Nothing here changes what a knockout costs when nothing is buried - an
  empty-handed knockout is exactly as free as it was under decision 0024.
- If a future feature wants to show what a cache holds before it is dug up,
  that is a wire format change, not a rethink of anything above.
