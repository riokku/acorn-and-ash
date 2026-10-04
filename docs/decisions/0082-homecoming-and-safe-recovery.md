# Homecoming and safe recovery

Knockout still returns a character home and buries belongings without expiry. Previously digging removed the entire cache even when the backpack could not hold everything. Recover only what fits, retain the same marked cache for leftovers, and save both backpack and cache changes together. Full backpacks produce existing pickup feedback.

A new private recovery-marker message carries all of that character's caches with 32-bit IDs. The existing public mound list retains its compact format and cap; it cannot erase private markers. Reconnect replaces the private list. No new recovery deadline or survival penalty is added.

The chest can store logs, sticks, bones and flowers together, keeping expedition food, tools, blueprints and trophies in the pack. Existing owner, distance, capacity and atomic-save checks apply. Home entry and resting feedback explain the return-and-prepare loop. Cabin windows gain a daylight-aware glow using the existing six-light pool, with individual materials disposed alongside their models.
