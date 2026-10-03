# 0073. Learning to build a home

**Status:** accepted · **Date:** 2026-10-03

## Context

Chris requested tent → teepee → small cabin → larger cabin progression, then
required skeleton-dropped blueprints that the player learns. He selected
occasional drops prioritizing the next unlearned tier, with knowledge belonging
to the character in its current world. XP remains a future design decision.

## Decision

A tent is known from the start. Each defeated skeleton keeps its normal bone
loot and has an initial 30% chance to drop the killer's next unlearned housing
blueprint. The drop is a normal world item. Clicking a carried blueprint learns
its tier permanently and consumes one; a duplicate remains available to store
or give away. The server requires possession and an idle, living player.

Housing upgrades replace the same owned home, one tier at a time. The Build
journal's second entry shows the next tier, ingredients and blueprint need.
Upgrades preserve position, heading, home ID, ownership, lock and all ten chest
slots. The server validates payment, learned tier, reach, footprint, nearby
players and an empty interior. Refusals spend nothing and return feedback.
Tent costs 6 sticks; upgrades cost 8 sticks + 4 logs, 10 logs, then 20 logs +
8 sticks. Existing cabins remain small cabins and imply earlier-tier knowledge.

Skills and blueprint consumption save in one SQLite transaction. Upgraded home
kind and material payment also save together before acknowledgment. Numeric
item/build indices only append; old worlds require no destructive migration.

Original procedural models share the game's painted low-poly materials. Canvas
shelters have poles, stitched hems, ropes, pegs and lanterns; the larger cabin
adds a sheltered porch. Tier scales are shared by interiors, collision, doors,
resting poses and chest reach. Indoor canvas roofs lift out of the view.

## Consequences

This creates permanent discoveries without committing to XP. Loot can be shared,
but learning stays private to a character/world. Chance and prices are initial
balance values for playtesting. Furnishing placement is still predefined;
free decorating and storage expansion remain separate work.
