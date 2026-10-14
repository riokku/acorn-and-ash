# 0182 — Parallel verification before deployment

## Context

PR #237's failed browser run spent 27 minutes in one shard and 11 in another.
Package tests also ran in dependency order on one runner, leaving the Worker
suite waiting for shared tests. Preview and deployment jobs rebuilt a client
that had already passed verification.

## Decision

Use one reusable verification workflow for PRs, staging and production. Run all
four package suites on independent runners alongside type, lint, format, asset
and build checks. Keep the existing `Checks` and `Browser smoke tests` branch
protection names; both fail unless every constituent job succeeds.

Split browser coverage over eight runners, each with one Playwright worker.
Keep every scenario, retry, assertion and existing time limit. The campfire
fixtures wait for their selected recipe and actual built kind, and collect
separate piles with separate E inputs, matching normal interaction semantics.

Upload only public client build files as a short-lived artifact named for the
workflow commit. Preview and deploy jobs download it from their own run after
all verification succeeds. Deployment still orders game server, database
migrations and website, then verifies the live version, health and sign-in.
Deployment concurrency remains serialized and never cancels an active deploy.

## Consequences

More independent runners shorten the critical path without removing coverage.
Runner-minute cost can increase with repeated installation/browser setup.
An unavailable build artifact fails deployment instead of rebuilding or using a
previous run's assets. Real production timing must be measured after merge;
local browser repetition is evidence for fixture reliability, not cloud speed.
