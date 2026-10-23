# The Sunreach Survey

Sunreach needed a reason to explore beyond its boundary. A personal three-step
expedition now sends players from a ranger outpost through Amber Dunes to a
buried survey vault. Only a deliberate E interaction advances the current clue;
the last step requires an active shovel. Progress uses the existing saved private
expedition state and packets, so no shared treasure can be exhausted by another
player and reconnecting does not reset the trail.

The board always offers Sunreach and Bonehollow alongside a rotating everyday
outing. Existing mission IDs, the third Bonehollow offer and packet sizes stay
stable. Rewards are claimed atomically at home. A permanent tool already at its
carry limit is skipped, rather than blocking the entire claim. The reward bag
is applied before other items so its capacity is available during the claim.

The survey pennant appends item/buildable/decoration IDs and reuses the existing
trail pennant figure unchanged. The outpost, notes, cairn and vault also reuse
existing art. Shared colliders match these arrangements; generated scenery and
player buildings keep their interaction areas clear. No model or texture assets
are introduced. A region card retains the last clue while exploring; the gallery
provides outpost and vault views for review.
