# 0087. One character per player, per world

**Status:** accepted · **Date:** 2026-10-04

## Context

Chris wants each player to have one character per realm (a world). Until now the
Home screen sent a name, a character and a tint every time anyone joined, and the
world accepted them every time. Nothing stopped a player renaming themselves or
changing how they looked on every visit, and the only copy of "who I am" that a
returning player saw was in their own browser's memory, so it did not follow them
to another computer.

## Decision

**A character is made once in a world, and then it is theirs.** The first time a
signed-in player joins a world, what they chose on the Home screen becomes their
character there. After that the world ignores any later name, character or tint
from that player, and still tells the others that they have arrived. The server
keeps it with the rest of what the world saves for them (decision 0057), so it
is the same on any computer.

**The Home screen asks the world, not the browser.** Once signed in, the client
asks for the player's character in this world (`GET /api/worlds/<world>/character`,
answered by the world itself for the key the web Worker looked up). If there is
one, the Home screen welcomes them back to it and goes straight in; if not, it
offers the one-time chance to make it, and says so.

**Each world is separate.** A player can make a character in each world, one per
world, and nothing carries from one to another, as the design already says.

## Consequences

- A name typed wrong stays wrong. A rename or a new look can be added later if
  Chris wants one; it would be a deliberate action, not a side effect of joining.
- A character a player already had keeps the name and look it last had, and that
  is now final.
- A connection with no player key (only the tests use these) is not protected by
  any of this, because it has no character to protect.
