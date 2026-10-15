# Recover only the latest death

Previously a character could accumulate buried belongings from every knockout indefinitely. The player now gets one recovery opportunity: each new knockout permanently removes their previous stash, including any partially recovered leftovers. This happens even when the new knockout has no items to bury. The existing half-pack loss, kept tools, owner-only recovery and full-backpack behavior remain.

The authoritative simulation emits storage-only loss events before creating the new cache. The server deletes the obsolete cache and its item rows and saves the changed backpack in the same transaction, then replaces recovery markers and public mounds. A loss is not reported as a successful dig-up. Stable character keys preserve ownership across reconnects; another character's caches and randomly buried treasure are unaffected.

When a saved world wakes, keep the highest cache ID for each known owner (IDs increase at burial), and permanently delete superseded caches and their contents in a transaction. This also supports worlds saved before the rule changed, regardless of row order. Unowned legacy caches have no recoverable owner and are not grouped together. No new network format or database column is needed. Update the recovery tooltip and knockout feedback to explain the rule.
