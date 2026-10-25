# 0230 — Soul storm and wardstone shelter

## Context

The Hollow King needed one memorable cooperative arena mechanic: readable danger, shelter players can reach, and a reason to help an exposed ally before damage begins.

## Decision

At 65% and 25% remaining health, the King can channel a soul storm after his current attack and recovery finish. A seven-second warning precedes five one-second pulses for 12 base damage each. Three fixed wardstones project 4.2-metre shelter circles inside a 34-metre storm boundary. Protection is magical proximity, checked by the server on each pulse; it is not a physical line-of-sight test. Indoor, downed and distant players are excluded. Normal armor and dodge validation still apply.

The King stops attacking during the channel, then offers a 3.8-second exposed recovery. A ten-second minimum gap after recovery separates waves. Existing three-second ally rescues can be completed during the warning or from shelter. Killing him ends the storm immediately; a full wipe resets both thresholds. All timing uses existing simulation ticks, with no new persistent state or background timers.

An eight-byte binary message supplies phase, remaining ticks, wave and the viewer's authoritative shelter/outside status. Text distinguishes exposed, sheltered and safely outside the storm; a direction arrow points exposed players to the nearest ward. A low rumble marks the active storm. Existing broken-stone cairns provide the landmarks; teal shelter rings and soft domes contrast with the violet perimeter/shroud. Overlays are prewarmed during loading and own/dispose their rendering resources. Reduced motion retains static shelter cues and omits the moving shroud.

## Consequences

Players can retreat, reach a ward or use the warning to rescue an ally; there is no enforced group-size gate or invulnerable health lock. Storm damage and timing remain tunable in the shared boss data. The replay gallery uses the same effect and HUD at `?gallery=king-storm`, with `&at=8.5` for inspection. Multiplayer difficulty still needs live playtesting.
