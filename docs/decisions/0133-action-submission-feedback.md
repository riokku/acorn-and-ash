# 0133 · Action submission feedback

## Context

The socket silently ignored crafting, item-use and placement requests while closed. The game could still mark a placement pending and dismiss a one-per-player or indoor decoration preview. Other menu actions gave no explanation. This left players unsure whether the action happened.

## Decision

Have these deliberate socket methods report whether they actually sent the request. Crafting, item use, gear changes, dropping/destroying items and outdoor/indoor placement share a client submission gate. An unavailable connection shows an immediate, specific “Reconnect to…” status for 3.2 seconds, above the menus. Placement bookkeeping and preview dismissal happen only after successful submission. Successful fresh submissions clear a preceding reconnect notice.

Keep server replies authoritative for inventory, construction and confirmations. Sending a request means submission, not completion. Do not queue or automatically replay disconnected clicks when the connection returns. Retain the existing chest pending and refusal flow.

## Consequences

Players can retry deliberately after reconnecting, and unsent placements retain their preview. A browser regression interrupts a real client socket, checks notices and unchanged simulation state, reconnects and verifies only a fresh click builds. Socket regressions cover each changed request type and ensure old offline clicks never replay. Tracking every submitted action through confirmation and standardizing server refusals remain separate follow-up work.
