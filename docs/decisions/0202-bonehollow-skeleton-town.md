# 0202 — Bonehollow skeleton town

Bonehollow adds a dangerous destination beyond the southeast forest, away from
the starting clearing. Its centre is (176, 140), on a level shelf that blends back
into the surrounding terrain. Wilderness prop IDs remain stable outside the town.

The settlement has four independent encounter districts and thirteen residents.
They reuse the existing skeleton combat, loot, notice, leash and respawn rules,
but remain available during the day. Four town groups have their own activation
limit so ordinary forest encounters retain their existing capacity. Only a nearby
district engages; visiting the gate does not alert the whole settlement. The map
labels the town, and its footprint is protected from new player construction.

Weathered cedar houses, a bell hall, market, graveyard and skull gateway are
modelled in Blender. The same builder exports the client model and shared solid
boxes so server movement and visible architecture agree. Each architectural
module is under 2,000 triangles. The road is a terrain decoration batch of many
small paving stones (9,600 triangles), not an individual prop. The complete town
is 15,500 triangles. Editable source and original-asset licensing are included.

Existing encounter IDs are preserved; town IDs 100–103 append to the list. No
network message or saved-state schema changes are required. Town residents gain
small scavenger/watch headwear while retaining the established animated rigs.
The gallery provides overview and district views for visual review; shared tests
cover placement, collision, activation and local aggression, and a browser test
checks approaching the populated town using the real simulation.
