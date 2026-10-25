# 0229 — The Last Bell victory sequence

## Context

The Hollow King needed a memorable animated conclusion and weapon reveal, without hiding the world, interrupting combat controls or implying that spectators earned contributor rewards.

## Decision

A confirmed killing blow starts an eleven-second local sequence at the King’s interpolated position. His existing collapse leads into expanding cyan/violet ground rings, spiraling souls and gold motes. The actual King’s Requiem model rises and turns in the same world renderer. A layered crown/title and delayed epic reward card accompany an original synthesized bell and rising fanfare. Text explicitly directs contributors to collect personal spoils; this presentation grants nothing and changes no loot rules.

The later encounter-clear message provides a fallback for a missed killing-blow event. A thirty-second local deduplication window prevents it from restarting a sequence. Only the authored boss site qualifies. The camera and gameplay controls remain available, and the overlay takes no pointer input. Reduced-motion mode uses static particles and weapon presentation, omits the soul ribbons and disables UI animation.

Effects are built once and rehearsed behind the existing loading curtain. They reuse the live enchanted-weapon geometry/materials, own only their effect resources and expire using wall-clock presentation time. Leaving the space or disconnecting clears them. Scheduled audio can be cancelled when muted or when the world is hidden, and releases its nodes on completion.

## Consequences

No new models, textures, recordings, server timers or persistent state are needed. A replayable `?gallery=king-victory` uses the same effect and HUD; `&at=4.8` pauses for inspection, and Replay starts the full sequence. Live multiplayer audio balance and visual intensity can be tuned after playtesting.
