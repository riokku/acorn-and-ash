# 0004. One input per tick, bundled before sending

**Status:** accepted · **Date:** 2026-09-17

## Context

The player should move the instant a key goes down, but the server owns the
result. That means the client predicts, the server decides, and the client has
to replay its unacknowledged inputs on top of whatever the server sends back.

Replay only lands on the same answer if the client and the server run the same
number of steps with the same time step. If the client sends "I moved for 17 ms"
the two drift apart and the player is corrected constantly.

## Decision

The client samples exactly one input per simulation tick: 20 per second, each
representing a fixed 50 ms. Inputs are numbered consecutively.

Those inputs are posted in bundles 15 times a second, so a message usually
carries one or two of them. Because the numbers are consecutive, only the first
sequence number travels.

The server simulates one input per tick. If a client falls behind, the server
works through up to three per tick to let them catch up; if nothing has arrived,
the player coasts to a stop. Every snapshot carries the newest sequence number
the server has actually simulated, and the client throws away everything up to
that and replays the rest.

## Consequences

- Prediction and reconciliation agree exactly, so corrections are rare and small.
- Cloudflare bills incoming WebSocket messages at 20:1, and bundling turns 20
  billed messages a second into 15. Bundling more aggressively would save money
  and cost responsiveness; 15 Hz is the compromise.
- A client cannot gain speed by sending inputs faster: extra inputs beyond the
  catch-up allowance sit in a queue that is capped at 40 and then drops its
  oldest entries.
- Inputs in one bundle must be consecutive. A future message that skips
  sequence numbers would need a different layout.
