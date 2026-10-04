# Private home decoration

## Context

Chris chose free placement and rotation with collision checks. Decoration should make expedition supplies and earned trophies useful, while keeping rest, storage and housing stations accessible.

## Decision

B opens decoration inside a home. Owners place a cedar bench, timber table, woven forest rug, warm/fern/moonlit lantern, flower planter or earned guardian trophy from a real-model preview; the mouse wheel rotates it. The outdoor build menu also offers colored lanterns and flower planters for private garden layouts. New furniture kinds append to the wire order.

Placement, moving and packing up are server-authoritative. Visitors can view the room but cannot rearrange it. Solid furniture keeps clear of people, existing furniture, walls, the doorway, the waking spot and useful stations. Rugs do not obstruct walking and can sit underneath furniture. Homes hold up to sixteen decorations.

Moving preserves the piece and costs nothing. Packing up refunds all original materials only if the backpack can hold them; otherwise both sides stay intact. Furniture and backpack changes save in one transaction. A bounded decoration state restores exact placement/rotation on reconnect. Each decorated home has its own cached room collision world; clients update the same colliders for prediction.

## Consequences

Players can rearrange freely without losing materials or disrupting shared-world resources. Decorative furniture is cosmetic; seating interactions can follow homecoming polish. Housing upgrades preserve furniture and refuse layouts that would obstruct a new station or waking spot until the owner rearranges them.
