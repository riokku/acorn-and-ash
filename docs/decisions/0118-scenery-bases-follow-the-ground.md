# 0118 · Scenery bases follow the ground

## Context

Chris found exposed, flat undersides on trees and rocks placed on hills. Sampling only the centre height puts a flat model base above the downhill ground.

## Decision

- Measure the actual lower geometry of each prop, including spreading roots, rather than using its narrower collision radius. Probe the terrain around that scaled footprint, including the visible ground mesh's sample spacing.
- Extend only the bottom portion below the lowest surrounding ground. Keep the original tree anchor, canopy, upright orientation and rock top. This is placement deformation of existing models; source geometry and assets remain unchanged.
- Instanced props use one burial depth per instance and a vertex weight for the lower base. Cache terrain probes until a prop's scale or anchor changes. Detailed and distant trees use the same detailed footprint. Regrowth refreshes the depth; small shakes keep roots buried and falling trees release them gradually.
- Include the extended base in render bounds. Clone only ground-bearing geometry and materials, preserving shared source resources and seasonal foliage materials.
- Apply equivalent geometry deformation before merging small shore stones and slough boulders. Stumps use the same grounding as other props.

## Consequences

Flat caps remain underground on slopes without lowering entire trees or tipping trunks. Existing gameplay anchors and collision rules remain unchanged. No extra draw calls or network messages are needed; standing props do not repeatedly sample terrain during animation.
