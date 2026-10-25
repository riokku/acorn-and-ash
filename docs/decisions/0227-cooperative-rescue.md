# 0227 — Cooperative rescue and readable boss danger

## Context

The Hollow King needs understandable danger and meaningful ways for nearby players to help each other, using the existing controls and knockout rules.

## Decision

An outdoor knockout with a living ally within 40 metres leaves a 15-second rescue window. Hold E within 2.4 metres for three uninterrupted server seconds to help the player rise with 35% health. Movement, a hit, another action, release or stale inputs reset progress. Helpers cannot combine partial channels. A lone player keeps the existing two-second return home. Knockout still buries belongings immediately; rescue saves the journey back rather than undoing its cost. Disconnecting ends any channel; no new persistent resurrection state or background timer is introduced.

A bounded binary nearby-allies message exposes health, rescue time and progress only to outdoor players within 40 metres. The HUD labels low health and rescue opportunities without requiring a party system. Existing reach gestures show the rescuer helping. The King’s cleave cone and whirlwind circle use the actual shared reach and cone angle, follow interpolated movement and disappear outside the attack. Text warnings distinguish both attacks; color is supplementary. These are runtime combat overlays using existing animation and rendering, with no new art assets.

## Consequences

Rescue competes with attacking and avoiding damage; additional helpers offer cover instead of speeding resurrection. The server owns proximity, deadlines and outcomes. Existing save and loot behavior is unchanged. Group difficulty and the rescue timings remain subject to multiplayer playtesting.
