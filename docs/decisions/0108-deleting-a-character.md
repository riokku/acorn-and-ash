# 0108 · Deleting a character and starting again

**Status:** accepted · **Date:** 2026-10-07

## Context

A character is made once per world and kept (decision 0087). Chris wanted a way to delete one and start over, and for everything that character made in the world to go away after 30 minutes. The question was what happens to the cabin, campfires, fences and decorations during those 30 minutes. Chris chose: they **stay standing but locked**, and all disappear together at 30 minutes.

## Decision

- **Where.** Settings → Account → **Delete character…**, and a small **Delete this character** link on the Enter World screen. Both ask the player to type the character's name (capitals and edge spaces don't matter) and press a red **Delete forever** button. Pressing Enter in the box never enters the world.
- **At once.** The character is gone as soon as the button is pressed: pack, hunger, map, fish collection, home unlocks and the rest of what the world saved for them. Their open tabs are closed with code 4003 and do not reconnect. The page reloads onto a blank character screen with a note saying what happened.
- **Buried caches** left by a knockout are removed immediately, since nobody else could ever dig them up.
- **Everything they built** is detached from the account (its owner becomes `~abandoned`), so a new character on the same account cannot walk into the old cabin. It is flagged locked, which already meant "nobody can use this": doors, campfires (also for cooking) and boats refuse everyone. Anyone standing inside is put out at the door. A boat with someone rowing is kept until they step off.
- **After 30 minutes** (`ABANDONED_BUILD_SECONDS`) each such piece is removed and everyone nearby is told. Previews and local runs use two minutes (`WORLD_ABANDONED_SECONDS`) so the end can be watched in one sitting.
- **Real time, no timers.** The deadline is a clock time saved with each piece. While players are connected the normal tick checks it; when a world wakes up it checks once. Nothing runs in an empty world, so hibernation and cost are unchanged (architecture rule 6).
- **Who can ask.** Only `apps/web`, signed in and from this site, reaches the route (`DELETE /api/worlds/:id/character`). The game server's own public routes answer 404 to it.

## Consequences

- The 30 minutes counts while the world is asleep too, because it uses wall-clock time: a world nobody visits for a day clears the old cabin the moment it next wakes.
- Deletion cannot be undone, and there is no grace period; the typed name is the only safeguard.
- The note on the character screen always says 30 minutes, even on previews, where the real wait is two.
- Other players see the old cabin as a locked house for half an hour. Items left in a chest inside go with it.
