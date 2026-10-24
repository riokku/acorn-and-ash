# 0225 — The Hollow King

## Context

The director requested a challenging giant skeleton boss in a ruined stronghold beyond Bonehollow, with several players potentially needed. It should reward preparation and readable teamwork, while reusing the existing art and authoritative combat rules.

## Decision

Crownbreaker Hold sits southeast of Bonehollow at (246, 212). Existing ruined masonry and cairns surround a cleared, gently blended arena. The Hollow King reuses the armored warrior, captain helm and greatsword at 3.1× scale. No new model or texture assets are introduced.

The encounter targets 3–5 prepared players without enforcing a group gate. Ancient armor reduces ordinary blows; actual attack recovery allows stronger counters. Long cleave wind-ups and a two-second whirlwind charge give time to dodge or retreat. At half health, longer combinations and more frequent whirlwinds raise the pressure without shortening the warnings. Armor prevents repeated stagger or knockback from locking the boss in place.

Recent damage contributors receive personal crown, greatsword, stew and decorative First Bell relic piles. Credit uses stable owner identity, includes recently fallen or disconnected helpers and excludes spectators. An uncollected personal relic persists through hibernation; at most one outstanding relic pile exists per owner. The crown and relic survive knockout. A full wipe heals the king after five seconds with no living group member in the arena. He walks back rather than teleporting.

Defeat starts a saved 30-minute real-time respawn deadline immediately, including the crumble animation and time while the world sleeps. It uses existing world metadata and needs no background timer. Normal encounter rest remains tick-based.

## Consequences

This adds append-only creature, item and decoration IDs, with corresponding rendering and wire compatibility coverage. A dedicated health bar explains armor and the enraged phase. Giant strides are scaled to match authoritative movement. The existing raider gallery can inspect `kind=hollowKing`; default galleries keep ordinary skeleton spacing. Group difficulty still needs live multiplayer playtesting and can be tuned in the shared data table.
