# 0136 · Outdoor placement results

## Context

Outdoor non-home refusals were silent. Home previews disappeared on submission, and optimistic placement data expired after three seconds regardless of whether the server had answered. Room/world broadcasts could not reliably confirm a specific request.

## Decision

Return a private result for every queued build request, after authoritative processing and successful persistence. Echo the existing packed command and an append-only reason index. Cover overwritten or discarded requests as well as placement rules; retain existing home replies for older clients.

Allow one outdoor placement in flight. Match its packed command, including centimetre rounding and angle wrapping. Keep the submitted preview fixed until the result; preserve it on refusal, close capped previews on success, and keep repeatable previews available. Escape hides a preview without cancelling a submitted operation. A late reply cannot close a newer preview. Retain pending footprints until the private result, not a guessed timer. Slow replies never retry automatically; disconnection prompts a check of surroundings and inventory.

## Consequences

Placement rules, costs, ownership and persistent results remain unchanged. Existing clients ignore the added private result. Updated clients need the new world server, included in previews and deployed before web by the workflow. Protocol, shared simulation, real Worker and browser checks cover command matching, refusals without spending, private delivery, persistence and delayed outcomes.
