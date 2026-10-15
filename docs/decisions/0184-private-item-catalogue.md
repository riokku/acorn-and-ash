# 0184 — Private item catalogue with explicit publication

## Context

Chris needs to inspect and adjust every item's name, description, rarity and
equipment bonuses without changing source code. Drafts must stay private until
he publishes them to every world on that site.

## Decision

Gate both editor HTML and every administration API behind a signed-in member,
a verified email matching the server-only `ADMIN_OWNER_EMAIL` secret, and a
linked Google identity. Missing configuration denies access. Anonymous preview
accounts cannot administer items. Mutations require the exact same Origin.
The owner's address never appears in public source or session responses.

A SQLite ItemCatalog Durable Object holds per-environment draft and published
overrides, revision numbers and a publication audit. Compare-and-swap revisions
protect saves and publication from stale tabs. Validate bounded fields at both
HTTP and storage boundaries. Saved item IDs, order, slots, recipes, stack limits
and other mechanics are immutable. Rarity is a displayed tier, not a loot roll.
Restoring defaults edits a draft and still requires Save and Publish.

Active worlds refresh published content through their existing ticks every 15
seconds and send a validated binary catalogue to clients on connect and change.
The simulation uses its own bonus table; clients use their own presentation
copy of names/descriptions/rarity and the same bonuses. Shared defaults are not
mutated. Lower health caps clamp health; raising a cap never heals. Worlds cache
the last published catalogue for recovery and stop all timers when empty.

## Consequences

Changes reach connected worlds without restarting them. Drafts survive reloads
and deployments, and future code defaults still apply to untouched fields. An
owner secret must be configured separately for staging and production. Preview
shortcuts do not bypass authorization; browser UI tests use mocked owner API
responses, with real D1 authorization, SQLite publication and live-world tests
covering the server boundaries.
