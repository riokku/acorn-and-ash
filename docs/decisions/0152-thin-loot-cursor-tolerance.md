# Thin loot cursor tolerance

Thin stems and bobbing loot could lose their hover label or miss a click as a
small pointer movement crossed a visible triangle gap.

Use the same selection for hover and right-click: prefer the actual pointer
ray, then sample three CSS pixels left/right/up/down only when it misses.
Every sample retains geometry visibility and scenery occlusion, and stays
inside the viewport. Restore the original pointer ray afterward. Inventory
counts, depletion, pickup reach and authoritative server requests are unchanged.

Extra rays run only after a direct miss; this is bounded to five samples on the
existing throttled hover path. Tests cover thin targets, direct-hit priority,
occlusion, invisible parents and restoring the actual cursor ray.
