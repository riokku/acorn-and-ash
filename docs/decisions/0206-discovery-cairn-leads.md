# 0206 — Sparse cairns that lead to existing discoveries

## Context

Useful camp, logging, grove and shrine rewards already exist, but a player can
walk past their clearings without knowing that a worthwhile detour is nearby.

## Decision

Reuse the existing three-stone cairn at up to three positions on the inward side
of each of those four discoveries. Placement is deterministic, bounded and shared
by client and server. Reject water, steep terrain, scenery overlaps and tightly
clustered markers. Each nearby cairn gives a compass direction, a reason to explore
and a guard warning where appropriate. These are clues, not a navigable route:
players still choose their way around trees and terrain.

Use the existing low-priority tracking hint, below immediate interaction prompts.
Animal tracks keep priority. Once the destination is discovered its cairns stop
nudging the player. Existing inspection, guard checks, personal rewards, recipes
and journal discovery flags remain authoritative and unchanged.

## Consequences

No new enemy spawns, reward inflation, map spoilers or packet/save fields. Cairns
reuse the existing stone geometry and collision, with corrected ground sampling
at the actual stone position and slight burial of the base. New construction
respects their footprint. The forest-trails gallery has a clue viewpoint and a
before toggle for reviewing placement at gameplay scale.
