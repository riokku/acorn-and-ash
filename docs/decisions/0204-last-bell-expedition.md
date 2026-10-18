# 0204 — The Last Bell of Bonehollow

## Context

Bonehollow had a settlement and independent patrols, but no complete reason to
prepare, explore it, overcome its defenders and return home with a keepsake.

## Decision

Pin a three-objective expedition to the existing home board: arrive, help defeat
six town watch, and defeat the bell-hall captain. Keep two rotating board choices.
The server credits only participating players with matching town defeats and
uses the existing persisted progression and atomic home reward claim.

The captain replaces one hall resident, retaining thirteen residents and the
existing district aggro boundaries. His deterministic two-combination/one-strike
pattern uses existing attack tells and whirlwind collision; below half health
combinations gain one swing. Recovery gives players a safe retaliation window.
His toughness scales with contributors. New item/enemy IDs are appended to
preserve saved inventories and binary protocol identifiers.

The reward is an original Blender-made, open-faced Last Watch helm, with modest
Protection, Vitality and Warmth. Shared immutable geometry is attached to the
animated head on both the captain and the player. The town gains watchtowers,
a larger bell, banners and emissive lanterns while retaining its road layout.

## Consequences

This is an optional repeatable outing, available from a tent, with no new quest
packet or save migration. The helm is retained on knockout. Existing patrol
respawn rules still apply; this is not a persistent town-clearing system. The
local location card explains progress without introducing a new map or menu.
