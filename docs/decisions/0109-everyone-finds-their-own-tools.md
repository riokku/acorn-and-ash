# 0109 · Everyone finds their own axe, bag and rod

**Status:** accepted · **Date:** 2026-10-07

## Context

The axe, the bag and the fishing rod lie in the home clearing, and the world remembered that one of them had been taken, for everybody. That worked while a character was never removed. With character deletion (decision 0108) a new character starting in the same world would have found the axe gone, with nothing to find it with. Chris chose that **everyone finds their own**.

## Decision

- Each character has their own set of taken pickups. Picking up the axe hides the axe for them only; everybody else still sees theirs.
- The server saves it per character (`player_pickups_taken`), tells each player only about their own, and a deleted character's set goes with them (decision 0108).
- Nobody can be blocked from placing something because of a pickup that only somebody else has taken: the placement checks treat every pickup as still there.
- **Existing worlds.** A character who already holds an axe, bag or rod keeps it counted as taken, so it does not reappear for them. Anyone not holding one finds their own.

## Consequences

- Several players can stand at the same stump and each pick up an axe. That is intended: the tools are a starting kit, not a scarce resource.
- Reading the old shared list is only done once, when the new table is first made.
