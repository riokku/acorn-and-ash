# 0072. A private chest at the foot of the bed

## Context

Chris asked to use the chest already in each cabin as ten storage slots, and
confirmed that it must be private to the cabin owner.

## Decision

Keep the existing chest and give it a separate pickable model and hinged lid.
Left-click opens a pack/chest panel; click transfers a stack and Shift-click
transfers one. The chest has ten ordered slots, each with the item's usual stack
size. It can hold extra tools, but worn bags remain pack upgrades. Withdrawals
respect the pack's available slots and item limits; partial transfers leave the
rest at their source. Escape or the close button puts the lid down.

Every request is validated against the server's current cabin, ownership,
distance to the chest, health and action. A visitor receives a refusal with no
contents. Only the requesting player receives chest state; it is never broadcast.
The browser stops gameplay input while the panel is open. Disconnecting or
changing rooms closes it.

Chest state belongs to the cabin id within that world. A new SQLite table stores
the exact slot array, with strict validation on restore. Each successful transfer
saves the pack and chest together in one synchronous storage transaction, before
acknowledgement. Existing worlds start with empty chests and retain their other
state. Client and server deploy together for the new compact chest messages.

## Consequences

Storage remains available after reconnecting or the world going to sleep. The
panel waits for server acknowledgements and explains capacity failures. This is
private home storage, without remote access, shared permissions, crafting from
storage or a new buildable chest recipe.
