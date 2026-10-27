# Browser checks for extensible menus

Five consecutive sampled PR runs (325–329) failed in browser shard 5 at the same
assertion: the garden smoke expected exactly four Yard entries. Outdoor benches
and tables correctly made six entries. Each run otherwise passed its other 29
shard cases. Recent completed staging deployments succeeded; intermediate
staging runs were superseded. This was a repeatable stale assertion, not a
transient browser or deployment failure.

Assert that the garden choices needed by the scenario are visible and unique;
do not assert the total size of an extensible menu. Keep the complete real-stack
scenario: gather flowers, construct a tent, place a lantern and verify its cost.
Check menu choices immediately after loading, before the long gathering walk.
A future missing/duplicate choice fails sooner, while new buildables stay valid.

No retries, timeouts, required checks or notification settings are weakened.
GitHub Actions email delivery is a personal account preference, independent of
repository workflow correctness. Existing runs use their original commits;
rerunning a pre-fix run cannot pick up this correction.

For movement comparisons, use a fresh world and an explicitly faced clear lane.
Require real walking displacement and observe the real server's velocity and
sprint flag. Compare speed per simulated second, not distance during equal
wall-clock key holds: a slow renderer can produce different input-tick counts
in those holds. Keep the 20% minimum sprint advantage and release keys in finally
blocks. A rendering stall should not masquerade as a movement-rule regression.
