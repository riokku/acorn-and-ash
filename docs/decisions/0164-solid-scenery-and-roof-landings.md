# Solid scenery and roof landings

River, waterfall, slough and spring rocks were client-only decoration. Existing scenery blocked horizontally but the shared player step only landed on terrain, so jumping onto a stump pushed the player away instead of supporting them.

Move stone placement and the existing seeded stone vertices into the deterministic shared package. Both rendering and collision use them. Shore pebbles use a separate shared random stream, so their solidity does not depend on plant rendering. Existing licensed boulder meshes supply checked, normalized collision triangles; the export script verifies them without changing art assets. Stump surfaces match the existing bark rings and cut cap.

Add bounded surface data to existing collision cylinders. The outdoor grid remains the broadphase; near a rock, height-sliced outlines block the body and triangle roofs support feet. Descending feet cross roofs before horizontal resolution. Only already-grounded players may follow a small rise; a side collision cannot lift someone onto a tall rock. Terrain, dug ground, weather ice and deep-water barriers retain their behavior; a solid roof above water can support a player. Tree/stump replacement indices remain stable. Trunk colliders extend below their planted base across walkable slopes.

No physics engine, network fields, new assets or changes to jump height. Tall rocks require a reachable ledge or approach. The collision outline conservatively covers small concavities; standable roofs follow the actual triangles.
