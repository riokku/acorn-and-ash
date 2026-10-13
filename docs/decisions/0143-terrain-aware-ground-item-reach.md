# Ground-item reach respects banks and floors

## Context

Keyboard selection and authoritative pickup/gathering checks used horizontal distance alone. An item across a steep bank, or directly above a player in a tunnel, could still be collected even though the mouse ray respected the intervening terrain.

## Decision

Keep the existing two-metre horizontal radius, including ordinary hops. Before selecting a nearby pickup, pile or gathering patch, also check vertical separation and a short sampled reach line from hand height to the item's rendered height. Solid terrain blocks that line; explicitly excavated cells remain open. Use the same shared check for client keyboard hints, mouse refusal text and server validation.

## Consequences

A bank or another floor cannot grant a pickup simply because its X/Z coordinates are close. Selection skips unreachable targets and can choose the next reachable one. Targeted mouse requests retain their existing no-fallback behavior. Checks run only for items within horizontal reach, with seven terrain probes at most. This changes no inventory costs, horizontal reach, controls, movement or drop placement semantics.
