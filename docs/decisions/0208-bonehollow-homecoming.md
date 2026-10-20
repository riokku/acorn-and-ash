# 0208 — Bring the Last Bell home

Bonehollow already rewards useful equipment. A visible keepsake lets a home tell
that adventure’s story without creating another progression currency.

Claiming the completed outing now includes a Last Bell keepsake. It uses the
existing Blender bell mesh at home scale, the existing decoration placement and
reclaim rules, and the existing server-owned inventory and save paths. It survives
knockout. Item and buildable wire IDs are appended, preserving old saves.

The board still grants all rewards atomically: a full pack leaves the completed
outing claimable. Each completed outing can award one keepsake; claiming again
without another completion awards nothing. Older completers can repeat the outing.
There is no retroactive grant inferred from helmet ownership, since gear can move
between players. No new artwork, asset download, or currency is introduced.
