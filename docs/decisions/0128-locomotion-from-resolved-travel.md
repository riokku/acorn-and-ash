# 0128 — Locomotion from resolved travel

## Context

Player motion retains requested horizontal velocity after collision or a deep-water boundary stops its position. Using that velocity for animation makes feet keep walking against an obstacle. Remote players can also keep walking in place after snapshots stop and their rendered position is held still.

## Decision

Drive character locomotion and character water wakes from resolved horizontal travel. For the local player, measure the position change across the predicted simulation tick being rendered. Keep that pace between ticks; doorway moves and server corrections reset the interpolation endpoints, so neither counts as a stride.

For other players, measure horizontal displacement across the snapshot interval being rendered. Cap it at the larger reported endpoint velocity to prevent correction jumps from speeding up the gait. When there is only one sample, or rendering holds an endpoint while waiting for more snapshots, use zero travel pace.

Keep the existing gait blend, animation clips, action timing, airborne poses and seated rowing behavior. Boat visuals retain their existing velocity feed. This pass changes presentation only; server collision, movement speed and prediction rules stay the same. Terrain foot placement is a separate pass.

## Consequences

Feet settle into idle against obstacles, partial wall slides use their actual pace, and distant characters stop walking in place during snapshot gaps. Horizontal speed avoids counting uphill elevation or stationary jumps as extra walking distance.
