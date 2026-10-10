# 0121 · Deep river pools and current

## Context

Chris wanted less regular reeds, visibly deep river spots that cannot be waded, and floating boats carried toward the lake while sloughs stay calm.

## Decision

- Carve seven irregular pockets below the existing river surface. Keep the banks and shallow routes around them. Sample the same added depth for terrain, the water shader and a shared 0.8 m wading limit. Deep-water collision slides characters toward the shallows; ice removes the barrier. Thawing moves anyone left over a deep pool into safe shallows. Woodland spoor also avoids inaccessible pools.
- Use deterministic, unequal reed gaps, independent riverbank groups, staggered clumps and varied blade counts. Lake and slough reeds vary their shore inset and density too, reusing the existing plant geometry.
- Export a shared downstream current in metres per second. It fades across slough mouths and as the river reaches the lake; slough interiors have zero current. Rowing adds propulsion to drift, so players can row upstream and glide to a stop in calm water.
- Generalize hull clearance, building, boarding, landing and rendered height to the connected river, sloughs and lake. Unoccupied, available boats drift on the server each tick. Publish and persist changed positions once per second using existing built-prop messages. Occupied boats continue to use rider snapshots. Ice stops both forms of drift.
- Predict unattended boat drift between updates, smoothing small corrections. Skip grass rebuilding and house collider rebuilding when only boat positions changed. Keep the new depth value in the river's existing interleaved attribute buffer to stay within WebGPU limits.

## Consequences

Dark water communicates a gameplay boundary while nearby shallows remain usable. Boats float at the local graded surface and can rest in sloughs. Water current is shared infrastructure for future floating objects; scenery and dropped items do not gain physics automatically. Worlds continue to stop simulating while asleep. No new model, texture asset or network format is needed.
