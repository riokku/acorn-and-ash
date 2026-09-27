# 0050. WoW-style mouse controls, tooltips and an inventory you can drag from

**Status:** accepted · **Date:** 2026-09-27

## Context

Chris asked for the mouse to work the way it does in World of Warcraft: free
to click on objects in the world and on the action bar, with the right
button turning the camera instead of every mouse movement doing it. He also
asked for hotbar tooltips on hover, a way to see everything carried rather
than only the six hotbar slots, and drag-and-drop from that view onto the
bar. Decision 0040 flagged the last one itself, as a known gap: "Manually
choosing which item goes in which slot is not built yet... worth a
follow-up once this is played with a little."

Every one of those changes touches the same thing: since Phase 0, the whole
game has run on the browser's pointer lock the entire time a player is
playing - the mouse is captured and invisible from the moment the curtain is
clicked until Escape releases it, and every mouse movement turns the camera.
There has never been a real, visible cursor to hover a tooltip with, or to
click a specific slot or a specific tree with, while actually playing.

That surfaced one real conflict, not a guess: decision 0026 already gave the
right mouse button a job, holding it down to wind up a charged attack. WoW
controls want that same button free for the camera. Asked directly, Chris
picked moving the charge onto a held left click instead: a quick left click
still swings exactly as it always has, and holding it past a short delay
commits to the same charged attack decision 0026 already described, rather
than repeating a light swing.

## Decision

**Pointer lock stops being "am I playing" and becomes "am I dragging the
camera right now," full stop.** `Controls` no longer takes a lock-change
callback at all: the HUD used to hear about every lock change so the curtain
could show or hide, but now the curtain is driven by a new `playing` flag
Game owns directly (`resume`/`pause`/`setPlaying`), set the moment the
curtain is clicked or Escape is pressed, with no round trip through a
browser permission. The right button requests the lock on its own mousedown
and releases it on mouseup, purely to let a drag turn any distance without
the cursor hitting the edge of the screen - it never becomes a game button
in its own right, and losing the lock no longer clears every held key the
way it used to (that used to double as "the player just quit to the
curtain," which is a real regression now that losing it can just mean a
drag ended while WASD is still genuinely held).

**Escape backs out one layer at a time**: whichever of the craft menu, the
build menu or the new inventory panel is open closes first; only once none
are does it bring the curtain back. The same key that used to be a browser
behaviour (releasing the lock) is now entirely our own.

**The left button keeps its existing job and picks up the old right
button's**, per Chris's own choice above. A tap is a light swing exactly as
before; held past `CHARGE_HOLD_MS` (400 ms - comfortably past a deliberate
click, comfortably before the charge's own one second finishes) it commits
to a charged attack instead, and stops repeating light swings while it does.
The server-side state machine already tolerated this without changing at
all: `Charge` only ever starts a charge while `Swing` is otherwise still
read normally, so sending both bits for the first few ticks of any left
click and letting the hold threshold sort out which one actually matters
turned out to need nothing new in `world-sim.ts`.

**A left click on the game world aims the camera at whatever ground point is
under the cursor, immediately before that same click is read as a swing or
a cast.** `Game.aimTowardsClickPoint` raycasts from the click's screen
position against a flat plane at the player's own height and turns the
result into a yaw with the exact same formula the smoke tests' own debug
`faceTowards` helper already used - so clicking a tree, an animal or the
water now does what looking straight at it with the mouse always did,
without teaching the reach checks in `packages/shared` anything new about
real 3D hit-testing. They still only ever compare a yaw and a distance, the
same simplification they made from the start. One subtlety mattered: the
follow camera's actual Three.js transform only otherwise catches up to a
fresh `look.yaw` once a frame, inside `updateLocalPlayer`, which runs after
this - so `aimTowardsClickPoint` forces a zero-time `camera.update()` first,
which changes nothing time-based but does bring its position and rotation
in line with `look.yaw` right now rather than a frame late.

**Hotbar slots can be pinned, independently of each other, and an unpinned
slot keeps behaving exactly as it always has.** `hotbar-layout.ts` is pure,
client-only logic with no server involvement at all - the server has never
had any notion of slots, only of equipping one item id, so nothing about
this touched the network protocol. `resolveHotbarSlots(carrying, pins)` is
the one function that decides what each of the six slots shows, and both
`Hotbar`'s own rendering and `Game`'s digit-key handling call the exact same
one, so a key press can never disagree with what is on screen. A pin
persists in `localStorage`, read once at startup and written back on every
drag, the same shape `preferences.ts` already uses for the Settings menu.

**The inventory panel shows everything carried, not only the six the
hotbar has room for** - `ItemId` already names eleven kinds, so carrying
more than six at once (an axe, a rod, a torch, and any three materials) was
already possible; those extra items were simply invisible before this.
Dragging an entry onto a hotbar slot pins it there; dragging a hotbar
slot's item back onto the panel unpins it. Clicking either a hotbar slot or
an inventory entry equips it too, the same as pressing its number key -
`Game.useItem` is the one gate all three paths (a key, a hotbar click, an
inventory click) go through, and it now also checks the item is actually
carried, since a pinned-but-not-currently-held slot is a new case a digit
key press could never have reached before.

**Tooltips are a small, reusable `Tooltip` wrapper**, anchored purely by
CSS above whatever it wraps rather than anything computed from the mouse -
it never needs to know where the cursor actually is, only whether it is
currently inside the element it wraps.

## Consequences

- Holding the left button down no longer keeps chopping at a steady rhythm
  past `CHARGE_HOLD_MS` - it starts winding up a charged attack instead.
  That is the trade Chris picked directly rather than a side effect: worth
  his own read on whether 400 ms feels right once he has actually played
  against it, or wants it nudged either way.
- A pinned hotbar slot can show an item that is not currently in the pack
  (dimmed, per the CSS), rather than disappearing. Not a bug: a drag is
  never silently forgotten, and the slot lights back up the moment the item
  is carried again.
- Nothing about chopping, catching, casting or building learned real 3D
  hit-testing - a click only ever decides which way the camera faces before
  the same yaw-and-distance checks that were already there take over. A
  click into open sky, or one that only grazes the very top or bottom edge
  of the view, can fail to hit the ground plane at all; the camera then
  simply keeps whatever heading it already had, the same as a click on
  empty ground already cost nothing.
- There is no hover feedback yet for a clickable tree, animal or patch of
  water - no changed cursor, no highlight - only the hotbar and the
  inventory panel got tooltips. Worth a follow-up once this has been played
  with a little, the same standing decision 0040 left for manual hotbar
  placement itself.
- The smoke tests that swing, cast or fight by sending a raw mouse click
  now also move Playwright's own virtual mouse to the middle of the screen
  first (`centerMouse`), since where a click lands on screen now matters -
  it aims the camera - in a way it never did while the mouse stayed
  captured and invisible for the whole session.
