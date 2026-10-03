# 0067 — Gathering feedback and movement during swift attacks

## Context

Gathering needed a clear next target, recognizable material sounds and a small
reward when a patch or pile is emptied. Swift attacks stopped movement even
though their upper-body animations can play over the walking cycle.

## Decision

Highlight exactly the item E will collect, following the existing priority of
loose tools, dropped piles and resource patches. Clone only its materials and
restore them when focus changes; mark a full-pack target in amber.

The server broadcasts compact collection events only after inventory transfer
succeeds. Logs, sticks and flowers have distinct synthesized sounds. The last
item adds a soft chime and a small pooled sparkle burst. Nearby players hear
attenuated sounds; menus, SFX settings and indoor separation are respected.
Expiry and unsuccessful attempts produce no success feedback.

Swift attacks keep normal movement throughout their impact and follow-through.
Their upper-body clips blend over walking and running. Charged strikes retain
their deliberate footing, and enemy wind-up swings retain their full-body pose.

## Consequences

Collection effects follow confirmed multiplayer results rather than prediction.
The new binary message needs matching client and server deployment. No gameplay
timers or external sound assets are added. Moving no longer cancels a swift
attack, so its impact and queued combo continue normally.
