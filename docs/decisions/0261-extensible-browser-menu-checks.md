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
