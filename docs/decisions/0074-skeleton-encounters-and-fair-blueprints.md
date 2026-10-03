# 0074. Skeleton encounters and fair blueprint progress

**Status:** accepted · **Date:** 2026-10-03

## Context

Chris authorized all seven gameplay-loop recommendations in order. He selected
15–25 minute expeditions, retained surprise raids alongside wanderers, guarded
ruins and nighttime patrols, and requested rising blueprint chances. Cooperative
contributors should get independent rolls with protected rewards.

## Decision

Six seeded encounter glades are selected in existing open wilderness without
moving saved scenery. Trail cairns mark wanderers, broken masonry marks guards,
and a frayed pennant marks a patrol route. One minion wanders, a warrior and mage
guard ruins, and a rogue/minion/warrior patrol only at night. Idle encounters do
not announce raids or pursue distant players. Approach within ten meters, or
land a blow, to engage. Retreat beyond the glade's 28-meter boundary or enter a
home to disengage. Existing readable attacks and one-attacker turns remain.

Exploration groups are bounded to three, with a slot reserved for night patrols.
Distant idle groups retire. A completed/retired site rests for ten minutes of
active world time; this cooldown persists through world sleep. Groups never
materialize under a player or in a newly built home. Encounter spawning is
checked once per second; movement and combat remain on the normal 20 Hz ticks.

Each defeated skeleton records fighters who actually damaged it. Living outdoor
contributors within 24 meters get their own next-unlearned housing blueprint
roll: 30%, 45%, 60%, 75%, 90%, then 100%. A generated drop resets that player's
streak; a miss increments it. Characters who know all tiers do not roll.

Protected reward piles store the stable character/world identity. Only that
character receives them in its ground-item list and can collect them; reconnects
with a new network ID preserve ownership. Piles do not merge with public drops.
After collection, a player can voluntarily drop or share a blueprint normally.
Bones remain public. Reward creation and roll progress save in one transaction
before rewards are announced. Old saves start at zero misses; existing piles stay
public. Item/build indices and existing wire layouts remain compatible.

## Consequences

Exploration creates chosen fights while raids still add pressure. The chance
curve is starting balance for playtesting; there is no XP or attendance timer.
Server and client derive landmarks and collision from the same seed. The e2e
and Worker test worlds with raids disabled also disable automatic exploration
encounters; dedicated encounter tests opt in. Further discoveries, facilities,
food, weather, decorating and homecoming follow this PR as separate stages.
