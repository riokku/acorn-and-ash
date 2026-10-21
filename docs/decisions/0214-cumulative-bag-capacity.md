# 0214 — Cumulative bag capacity

Players need more inventory space as loot variety grows. Previously, only the first bag increased capacity.

Each collected bag now adds four slots to the starting six, capped at 24 total. The fifth bag supplies the final two slots. Bags take no slots themselves, can be collected into a full inventory, and remain protected from discard, storage transfer and knockout. At the cap, further bags stay on the ground.

Capacity is derived from the existing saved bag count; no new save field or wire ID is needed. Old saves with one bag retain ten slots. Both client and server use the same capacity and pickup rules.
