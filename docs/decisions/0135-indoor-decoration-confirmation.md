# 0135 · Indoor decoration confirmation

## Context

Indoor placement dismissed its preview as soon as a request was sent, including when the server would refuse it. Successful room state was broadcast to everybody, so an unrelated update could not safely act as a private acknowledgement. Moving and packing up furniture had the same ambiguity under latency.

## Decision

Keep the existing room broadcasts and add an eight-byte private `DecorationReply` carrying the submitted action, kind, existing ID and result. Send it after the authoritative request has been processed and state/packs updated. Allow one decoration request in flight; match its private reply rather than treating room broadcasts as confirmations.

Keep and freeze a submitted placement preview while waiting, and close it only on confirmed success. A refusal leaves it available for adjustment or retry. Escape hides the preview without cancelling an already sent request. Track the submitted preview by object identity so a late reply never closes a newer preview. Disable duplicate move/pack-up submissions and show specific outcomes above menus. Slow replies remain pending; connection loss clears the waiting gate and asks the player to check their room and pack after reconnecting.

## Consequences

Placement rules, costs, ownership, storage and the existing models are unchanged. Older clients ignore the added private reply and keep receiving room state; this client needs the updated server for decoration requests to resolve. The existing deployment runs server before web. Client/protocol tests and real Worker/browser checks cover private delivery, delayed replies, refusal/retry, unrelated broadcasts and newer-preview preservation. Outdoor building feedback remains a separate pass.
