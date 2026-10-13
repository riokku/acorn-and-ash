# 0134 · Crafting confirmation and refusal

## Context

Craft requests already had private success replies, but unsuccessful requests gave no reply. Repeated recipe clicks could send several requests while the first was still waiting, and a stale pack or changed station availability made the silence confusing.

## Decision

Expose the existing authoritative crafting checks as refusal reasons and use the same checks for actual crafting. Send a private, additive three-byte `CraftRefused` message with the requested item and an append-only reason index. Keep the existing success message and inventory updates.

The client allows one craft request in flight. All craft entries and their hotkeys wait for its matching confirmation or refusal; building entries remain available. Show waiting feedback immediately, and an explicit slow-response status after eight seconds. Closing the journal does not forget the request. Never infer success, automatically retry, or unlock a slow request merely because time passed. A disconnected request clears the waiting gate and tells the player to check their pack after reconnecting before trying again.

## Consequences

Crafting costs, station/reach rules and results stay authoritative and unchanged. Refusals explain missing recipes/materials, full packs, already-owned tools, busy characters and station requirements. Older clients ignore the added refusal message; this client needs the updated server for refused requests to resolve. Deploy the game server before the web client, as the staging workflow already does. Unit/protocol, real Worker and delayed browser checks cover results, unchanged inventory on refusal, and duplicate prevention.
