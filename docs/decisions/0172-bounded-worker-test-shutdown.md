# Bounded Workers test shutdown

The staging run after PR224 passed every shared/client/server test file, including all 91 world tests by 02:43 UTC, but never emitted the Workers runner summary or exited. It occupied the serialized staging queue until cancelled at 04:31 UTC. Neither deploy step had started. The exact internal Workers-pool shutdown wait is not observable in the saved logs.

Test clients now have suite-owned cleanup: after each test, close all remaining sockets and await their close handshakes, with a four-second deadline. This also cleans up tests that throw before their manual close calls. Closing an already closing/closed socket is a no-op. No live game logic changes.

Staging/production validation is split into named typecheck, lint, test and asset steps. Tests have a 20-minute limit; deployment jobs a 40-minute ceiling. The PR Checks job has the same bounded test step and a 35-minute ceiling. The existing tests remain required; timeouts fail the run and never turn incomplete tests into a successful deployment. Deployment serialization is retained so an in-flight server/database/site update cannot be cancelled by a later merge.
