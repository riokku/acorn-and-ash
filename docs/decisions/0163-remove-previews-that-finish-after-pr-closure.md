# 0163 — Remove previews that finish after PR closure

## Context

Preview deployment waits for Checks. A PR can merge while those checks run: the close-event cleanup finds no Worker, then the preview job creates one afterward. These throwaway servers accumulate until Cloudflare's 100-Worker limit blocks new previews. Closed PRs 209, 210 and 214 showed successful preview deployments after their earlier close cleanup.

## Decision

Check live PR state before preview deployment and skip uploads for closed PRs. Check it again after the preview steps, even if another step failed; apply the existing force-removal policy only to the verified, closed PR's own preview Worker. Keep the separate close-event cleanup for PRs that close after a preview finishes. Suppress preview-link comments when the PR has closed.

## Consequences

Both merge/deploy orderings have cleanup. The read-only helper validates PR identity, repository ownership and the exact preview Worker name, and never treats API failures as missing resources. Staging, production and unrelated Workers cannot be selected. Tests cover open, closed, missing, service failures and ownership/name boundaries; no credentials or Worker content are logged.
