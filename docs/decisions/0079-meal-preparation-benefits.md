# Meal preparation benefits

## Context

Discoveries already teach trail rations, forest stew and berry tea. Those meals should help players prepare for an expedition, alongside the new cooking facilities, without adding another survival need.

## Decision

Chris selected one benefit at a time for ten minutes of the character's connected play. Trail rations shorten dodge recovery by 25%; forest stew restores two health every ten seconds; berry tea shortens hand-gathering recovery by 25%. Tick rounding applies to cooldowns. Dodge invulnerability, damage, movement speed, resource totals and fishing timing remain unchanged.

Eating a special meal deliberately works at full hunger. A new special meal replaces or refreshes the previous benefit. Ordinary food still needs hunger and preserves an active meal. Time pauses when the character disconnects, even if friends keep that world awake. Eating, inventory consumption and benefit state save together; reconnect restores the remaining ticks. Benefits remain character/world-specific.

The server owns effects and expiry. A private message reports the active meal and remaining ticks. The client uses the same recovery value for movement prediction and shows one compact indicator only while a benefit is active. The journal and inventory explain each effect, replacement and disconnected pause.

## Consequences

No energy meter or XP system is introduced. The existing meal models, icons, recipes and discovery gates remain useful. Saved timers are strictly bounded, and old characters without a meal load without a benefit. Future tuning can adjust recovery or healing without changing item identities.
