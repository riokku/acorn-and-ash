# Quiet stalking and readable wildlife attention

## Context

Prey used only distance to decide when to flee. Running and walking felt identical to wildlife, and calm animals jumped straight into an escape without a readable reaction.

## Decision

Outdoor prey now evaluates every living outdoor player using actual horizontal movement. Its noticing radius is 48% of the species' original alert distance while stationary, 72% while walking and 125% while sprinting. The most noticeable player wins; a nearby quiet player cannot mask another player's running. Once fleeing, the closest player and existing safe distance govern recovery.

At up to 1.5 times its noticing radius, prey pauses and gradually turns to watch the approach. Inside the noticing radius, suspicion builds for 1.6 seconds while walking, or 0.8 seconds while sprinting, before escape. Backing off drains suspicion over 2.5 seconds. A surprise within 1.8 metres and nearby predators still cause immediate flight. Species with combat behavior keep their existing detection and attacks.

The server owns suspicion, facing, movement and the existing animal alert pose bit. No client requests, message sizes, persisted state, controls or models are added. Existing elk head/ear reactions and small-animal alert poses show the watching phase.

## Consequences

Walking and pausing give players a useful approach technique without a new stealth control or meter. Multiplayer runners can spoil a hunt. Detection remains a simple movement-and-distance rule; vegetation occlusion, wind scent, sounds from tools and live tracks can be separate future changes.
