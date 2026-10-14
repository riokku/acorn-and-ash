# WebSocket close handshakes and bounded validation

The staging run after PR224 passed every test file by 02:43 UTC but its Workers runner never exited. It blocked the serialized staging queue until cancelled at 04:31 UTC; neither deploy step had started. A fixture check then reproduced missing close replies: the Durable Object dropped a departing player but left the hibernatable socket half-open.

The server now replies to a peer close before releasing the player. Already closed/failed sockets still clean up safely; server-initiated rejection/takeover codes are preserved. A real Workers regression checks the client receives a normal close and the empty world stops ticking.

Test clients have suite-owned cleanup: after each test, close remaining sockets and await replies with a four-second deadline, including clients left by failed tests. This makes leaked/half-open connections fail at their test boundary rather than pool disposal.

Staging/production validation is split into named steps. Tests have a 20-minute limit; deployment jobs a 40-minute ceiling; PR Checks a 35-minute ceiling with bounded tests. Timeouts fail and cannot bypass validation. Deployment serialization is retained so later merges cannot interrupt server/database/site updates.
