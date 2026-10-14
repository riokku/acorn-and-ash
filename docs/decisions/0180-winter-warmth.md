# Winter Warmth

## Context

Chris requested cold protection from warm jackets, hats and nearby campfires, and chose warnings followed by slow health loss after a generous grace period.

## Decision

Equipment supplies an insulation rating, shown as Warmth alongside Power, Protection and Vitality. Ordinary winter requires 60; blizzards require 80. A warm jacket adds 60, the bear hat 25, mage hat 15, traveler's tunic/trousers 10 each, rogue mask/boots/gloves 5 each. The rating is capped at 100. Character body choices remain cosmetic.

Body warmth is a separate 0–100 meter, advanced only on active server ticks. Unprotected ordinary winter drains 0.6 points/second; a blizzard drains 0.8. Partial insulation reduces the drain. At 35 the HUD explains recovery options. After reaching zero there are 30 seconds of grace and a five-second damage interval: the first one-point health loss is after 35 seconds at zero, then one point every five seconds. Cold cannot be dodged or reduced by armor, and does not cause flinching, directional hit feedback or camera shakes. Knockout uses ordinary recovery and resets warmth to avoid a repeated exposure knockout during waking.

Any lit campfire within 4.5 horizontal metres and 2.5 vertical metres restores 2 points/second; expired, unlit or distant fires contribute nothing. Indoor homes restore one point/second. Sufficient insulation or leaving winter restores 0.5 points/second. Recovery resets the cold countdown.

The jacket is crafted from eight reeds and two rope; the mage hat from four reeds and one rope. A Gear page groups clothing and the shield. The raccoon hollow cache adds a bear hat for new claims. Existing clothing rendering supplies the jacket's appearance. Its multipart arm meshes now receive sleeves and gloves, and helms load from the separately exported gear assets rather than looking for removed parts in the plain bodies; `?gallery=winter-gear` shows it on any body, with `&before` for plain clothes. Item IDs append to the wire order.

## Consequences

A private five-byte message reports visible warmth changes and recovery hints. SQLite stores warmth and its cold timer; health retains fractional armor damage on both periodic and disconnect saves, with rounding confined to display messages and positive fractional health shown as at least one point while the character is alive; old saves default to warm, disconnects pause exposure and reconnects cannot reset the grace period. Character deletion/reset clears the new per-player table. Warmth does not change movement or attack timing, and the existing automatic fire burn-out still applies.
