# Woodland tracks and creatures

Chris approved Roosevelt elk, curious raccoons and moss-covered woodland
guardians, with distinct tracks, full models and animations. Following them
rewards a journal sketch, a personal cache and an earned home trophy respectively.

Stable dens occupy three glades reserved by the homestead rules. Paired tracks
lead from the inner woods and follow the actual terrain. A nearby contextual hint
identifies the spoor; map markers appear only after discovery. Original scenery
colliders remain the input to ruin placement, preserving existing discovery sites
when the new glades open.

Elk require quiet observation of a living, calm animal. Curious raccoons guide
approaching visitors back toward their cache and cannot be hunted or hurt players.
The guardian takes six light or three charged hits, telegraphs its attack for
1.1 seconds, and returns when a chase leaves its 18 m encounter area. New creatures
respect forest and home collision. Art uses separate limb, neck, head and tail
joints, distance-driven gait and blended idle, alert and combat reactions.

The existing per-character/world discovery masks now contain seven entries.
For the guardian, the found bit specifically proves participation in a victory:
only living damage helpers within 24 m receive it. Visiting alone never grants
it. The normal inspect action then grants the personal trophy, with inventory
and claimed state saved atomically. Full packs retain eligibility indefinitely.
Returning to the hollow after a respawn can still collect an earned trophy.
Elk observation has no inventory payout; raccoon supplies remain personal and
once-only. Ordinary gathering stays shared.

The trophy appends to the saved item order and builds as a private home-area
cosmetic. No XP or additional daily upkeep is introduced. Existing discovery
and inventory tables provide persistence, so no schema migration is needed.
