# 0063. Skeleton raids

**Status:** accepted · **Date:** 2026-10-02

## Context

Chris asked for enemies that attack at random, in groups of one to three,
with a warning before they arrive. They should fight with the same moves as
the player, and the combat should feel like a big-studio game. He sent
KayKit's CC0 skeleton pack (minion, rogue, warrior, mage) without its
weapons. His answers to the open questions were:

- raids come at any time, more often at night;
- anywhere outdoors, with the cabin safe;
- the mage fights up close like the others;
- every skeleton beaten drops bones to pick up.

## Decision

**The rules live in `packages/shared`, and the server decides everything.**

- Raid pacing and each kind's toughness, damage, speed, wind-up, combo,
  dodge chance and loot are one data table:
  [`data/raiders.ts`](../../packages/shared/src/data/raiders.ts).
- The raid itself is in [`sim/raids.ts`](../../packages/shared/src/sim/raids.ts).
  It drives each skeleton through the player's own moves: the light combo,
  the charged strike and the dodge roll. Wind-ups, i-frames and staggers
  therefore work the same on both sides.

**How a raid plays out**

- Raids come every 4 to 6 minutes spent outdoors, and twice as often at night.
- A raid turns up 32 to 38 m away and walks in. Groups are one to three
  strong, and night groups are bigger.
- Only one skeleton attacks a player at a time. The others circle about
  4 m off.
- Every attack opens with a wind-up you can see, so a roll or a step back
  always answers it. The warrior shrugs off light swings mid-attack; a
  charged strike still stops it.
- Going indoors makes the raid wait 18 seconds by the door, then give up.
- A knockout ends the raid.
- Beaten skeletons leave bones, picked up with `E`.

**What the player sees and hears**

- A banner ("Skeleton raid! Three skeletons, behind you") and a war horn.
- A "2 skeletons left" counter.
- Red diamonds on the minimap.
- A health bar over any skeleton that is hurt, close or aimed at.
- Arrows on a flattened ring round the player for skeletons off screen.
  They turn red and pulse while that skeleton winds up.
- Red edges and an arc on the side a blow came from, and a heartbeat at low
  health.
- Fight hints in the hint bar.
- A soft lock: a click swings towards the best-placed skeleton within about
  3.4 m.

All the sounds are synthesized, so there are no recordings to license.

**Weapons are placeholders.** They are primitive shapes (sword, dagger,
greatsword, staff with an orb) built in
[`raider-weapons.ts`](../../apps/client/src/scene/raider-weapons.ts), until
real models come along.

**Skeletons are drawn before they are needed.** The first time a skeleton
was drawn, the browser had to build its shaders, and the game froze for a
moment just as the raid arrived. To avoid this:

- While the world loads, the game draws one group's worth of each kind out
  of sight (`RaiderCrowd.rehearse`).
- After that, beaten or departed skeletons are reused instead of thrown
  away.

Measured in the test browser, no shaders are built when a raid turns up.

**Raid timing per environment.** `WORLD_RAID_SECONDS` sets the shortest gap
between raids: 240 on staging and production, and 60 on local runs and
previews so a raid can be waited for. Two places turn raids off:

- the server's own tests;
- a new `e2e` Wrangler environment used by `pnpm test:e2e`.

Without this, a raid could knock the test player out mid-test.

## Consequences

- The skeletons are 4.6k to 5.9k triangles. That is over the 5k animal
  budget, but they share the player's rig and are held to the 10k player
  budget instead.
- Every skeleton kind costs some memory from the moment a world loads,
  whether or not a raid comes.
- Changing pacing, damage or toughness is one edit to the data table. The
  gallery shows every kind's moves: `?gallery=raiders`, with `&kind=`,
  `&demo=` and `&strip=`.
- Raids are aimed at one player. A world can have at most four at once, and
  one due near another raid waits. Large crowds are left for P5.
