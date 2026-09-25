# 0037. Choosing a name and a character

**Status:** accepted · **Date:** 2026-09-25

## Context

Chris asked for a Home page where players pick their character and a name
before playing - exactly the piece decision 0036 named and deliberately
deferred once Knight proved real character animation worked. Two things
had to be decided before writing any code.

**How many characters can actually be picked.** The pack has six -
Barbarian, Knight, Mage, Ranger, Rogue, Rogue Hooded - sharing one skeleton,
but only Knight has been converted to a real, animated `.glb` so far.
Bringing in the other five is the same kind of work 0036 itself records at
length for Knight alone: real Blender scripting, NLA strips to merge
animation bundles onto each one's own armature, a facing fix, a scale pass,
several rounds of a grip and a swing measured against actual screenshots
Chris sent back. That is real art-pipeline work belonging to its own pass,
not something to redo blindly for five more characters inside a task about
building a screen. So the picker shows the whole roster - Chris's own
long-term plan, and what makes the screen worth building now rather than
later - but only Knight is selectable; the rest show locked, "coming soon."

**Whether a name is a local label or something the world actually knows.**
The simplest version would keep a chosen name and tint entirely on this
browser, cosmetic and private. That fits a single-player toy, not a game
built for "10-50 players per world." Sitting across a clearing from three
strangely-tinted Knights with no way to tell them apart defeats the point of
a name screen, so this pass wires the choice all the way through: the
server hears it, remembers it, and tells everyone else.

## Decision

**A Home screen, shown before the game ever connects.** `apps/client/src/home`
holds it: a name field (2-20 characters), the character picker described
above, and a row of tint swatches - the one real per-player customisation
that already existed (`colorForPlayer`, deriving a colour from network id),
now something chosen instead of assigned. `main.ts` mounts it first, into
its own `#home` element alongside the existing `#scene` and `#hud`; only
once "Enter the clearing" is pressed does it unmount and hand off to
`Game`, exactly the object it always was. The choice is written to
`localStorage` next to the existing `playerKey` and read back to prefill the
form next time - but the screen always shows, every session, rather than
skipping itself for a returning player. Simpler than deciding when it is
safe to skip, and a player who wants to change their tint or their name
always can.

**A small addition to the wire protocol, not a new one.** A `Hello` client
message (name, character, tint) is sent once right after `Welcome`, and
again on every reconnect - a fresh connection is a clean slate on the
server, nothing carries over automatically. A `Roster` server message
answers it: every currently-known name, character and tint, sent whole to a
newly joined player and broadcast again to everybody whenever it changes -
the same reconciling, send-the-small-whole-list approach `BuiltProps` and
`BuriedCaches` already use, rather than a new design. The server re-checks
everything a `Hello` claims rather than trusting it: `sanitizePlayerName`
and length limits run again server-side, and a character that is not
`available` in `packages/shared/src/data/characters.ts` is silently
replaced with Knight regardless of what was asked for - the same rule the
picker enforces client-side, enforced again because a client's own word for
what it asked is never enough (architecture rule 1).

**Remembered server-side too.** The `players` SQLite table gained `name`,
`character_index` and `color_index` columns, added with the same
`addColumn` migration helper `trees` and `built_props` already use for
exactly this reason - a world played before this release has the table as
it was. A returning player's name is loaded the moment they reconnect, so
they show up correctly in the very first `Roster` sent to whoever is
already there, without waiting on their own fresh `Hello` to land a moment
later.

**A name floats over a character's head.** `apps/client/src/scene/nameplate.ts`
draws a name to a small offscreen canvas once and keeps it as a
`THREE.Sprite`, the cheapest way to get crisp, always-camera-facing text
without new geometry - the same reasoning that already put the HUD itself
in plain HTML over the canvas rather than in the 3D scene. `Character`
gained one method, `setName`, implemented once and shared by both the real
animated model and the placeholder capsule via a small `attachNameplate`
helper, so neither variant had to duplicate the sprite bookkeeping. A
remote player's tint and name come from the roster the moment it is known;
before that (or for an old client that never sends a `Hello` at all) a
character still renders, coloured by the same netId-derived hue as before
and with no name shown, never blocked on identity to draw at all.

## Consequences

- Six characters are shown; one is real. Converting the rest is unchanged,
  separate future work - flip `available: true` in
  `packages/shared/src/data/characters.ts` once one is actually converted,
  and the picker, the wire format and the roster all already have the shape
  to carry it with no further changes.
- A name is capped at 20 characters and sanitised (control characters
  stripped, trimmed) on both ends, but nothing here moderates what a real
  word says - a small concern for a handful of friends, a real one once
  strangers can join a public world. Left for whenever accounts (Phase 1)
  give a name something to be tied to.
- Every existing Playwright smoke test used to open straight into a running
  game; all of them now land on the Home screen first. Rather than teach
  each of the two dozen or so tests about it individually, the one
  `waitForConnected` helper they all already call now passes through it
  first if it is showing - typing a fixed test name and pressing play - so
  the rest of the suite needed no changes beyond that. A few new tests
  cover the screen itself: the picker's locked/unlocked shape, that an
  empty or one-character name cannot get through, and that a chosen name
  actually reaches the HUD's own greeting once inside.
- Confirmed clean: full monorepo typecheck, and the shared, client and
  game-server test suites - including new coverage for the `Hello`/`Roster`
  wire format round-tripping and refusing rubbish, the server persisting
  and broadcasting identity through a real reconnect (via the game-server
  package's own Durable Object test harness), and the client's identity
  storage falling back sensibly for a value this build no longer
  recognises. What none of that confirms, the same gap 0033 and 0036 both
  recorded honestly rather than glossing over: how the screen and the
  floating name actually look in a real render, which this sandbox's own
  slow, uneven rendering makes unreliable to judge live. The Home screen's
  own visual design was worked out first as a couple of static mockups shown
  to Chris, rather than guessed at blind, but the version that shipped is
  built from that direction rather than confirmed pixel-for-pixel against
  it.
