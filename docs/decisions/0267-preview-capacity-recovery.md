# Recover capacity from closed previews

PRs 336 and 338 passed every package and browser check, then failed while
creating their preview servers: Cloudflare's free account allows 100 Durable
Object namespaces. A read-only audit found 99 namespaces, including 91 servers
for closed PRs 10–213. These servers survived an old merge/deploy race: cleanup ran before their
previews existed. PR 219 fixed that race (decision 0163), but historical
leftovers remained. The newer lifecycle guards stay in place.

Before uploading previews, serialize a bounded capacity recovery job. With at
most 80 namespaces, it needs only one read. Above that threshold, inventory all
pages, verify same-repository PR ownership and closure, and retire the oldest
eligible preview Workers until space recovers, up to 20 Workers per run. Use the
same service-delete endpoint and force flag as the existing Wrangler cleanup.
Recheck closure immediately before each deletion and verify its namespaces
actually disappear before continuing. A canary retired only PR 10 and confirmed
that the count fell from 99 to 98 before enabling the larger bound.

Only exact preview names with known World/ItemCatalog classes qualify. Open PRs,
unknown classes, staging, production and other repositories are excluded. API
failures or a reopening stop cleanup. Default CLI behavior remains read-only;
writing requires an explicit environment switch. Fail if two free slots cannot
be recovered. Run capacity recovery first so it cannot queue behind long browser shards.
Normal verification still runs after a failed/skipped preflight unless the run
is cancelled; only preview deployment requires both capacity and checks.

This discards only obsolete, closed-PR test worlds, as the existing closure job
does. It does not reset live worlds, weaken checks or change the Cloudflare plan.
Regression tests cover scope, limits, pagination, reopening, refusal, idempotence,
namespace-release verification and the fast path when sufficient space exists.
