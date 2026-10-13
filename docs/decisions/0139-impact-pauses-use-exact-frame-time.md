# Impact pauses use exact frame time

## Context

A character's hit pause consumed a whole render frame whenever any pause remained. A 25-millisecond pause could therefore freeze a 100-millisecond frame, making chopping and combat feel heavier on slower devices. Gait and action blends also continued changing underneath a frozen animation.

## Decision

Split each frame into the exact frozen duration and the remaining active duration. Advance gait and move blends, overlays and eating only through active time; scale gait playback so the mixer advances by that same duration. Catch the authoritative action pose back up using only active time. Keep every existing pause length and combat rule.

## Consequences

Short impact pauses end at the same time across frame rates. A slow frame can continue animating after its pause finishes, and a fully frozen frame holds the rendered pose. Tests compare actual animated bone positions across 30, 60, 120 FPS and a single coarse frame, including a zero-duration update.
