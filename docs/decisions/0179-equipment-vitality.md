# Equipment Vitality

## Context

Chris approved Vitality as the third equipment stat, increasing maximum health with selected worn gear. Current health must remain coherent through swaps, healing, knockout and reconnect.

## Decision

Vitality is maximum health, starting at 100 and capped at 150. The bear hat adds 15; the mage hat and traveler's tunic add 10 each; the rogue mask adds 5. Body choices contribute nothing. The forgotten camp now awards a traveler's tunic with its existing reward, giving new explorers a normal-play source.

Equipping only raises the cap: it never grants health. Removing equipment clamps excess current health to the smaller cap and sends an adjustment flag using a spare bit in the existing Health message. Clients update the meter without playing hit sounds, shaking the camera or cancelling sign-out for this adjustment. Re-equipping and reconnecting do not refill health.

The server derives the cap from saved worn gear, clamps restored health and uses the cap for meal healing and knockout recovery. The character panel, health meter and combat overlay use the same shared derived value. Item comparisons show Vitality in health points, Power and Protection in percentages.

## Consequences

No duplicate maximum-health field needs persistence or synchronization. Old saves default to the existing 100-health baseline; item indices and the Health message length retain their existing format. Already-claimed camp rewards are not reissued, preserving one-time claims.
