# 0069 — Pacific Northwest tree models and mature canopy

## Context

The forest needed models matching Douglas-fir, western redcedar and Sitka
spruce, with some very tall trees to make the player feel enclosed by woods.
The existing pine, birch and oak art did not express that direction.

## Decision

Ship original, reproducible meshes with tapered trunks, textured bark,
branch whorls and irregular green needle sprays. Fir has a layered crown,
cedar flatter drooping sprays and spruce a dense pointed crown. Detailed
meshes use 2,510–3,398 triangles; distant meshes use 560–632. The generator,
mesh checks and asset provenance are checked in together.

Base heights are 14, 12 and 16 metres. An independent seeded stream gives
about 12% of trees a mature scale of 1.65–2, yielding a mixture up to 32 metres.
Existing positions, species choices and IDs are preserved. Wilderness draws
compact near/far instance lists, updating only when the player moves, with
simpler models beyond 80 metres. The clearing retains full-detail trees.

Visible labels change to the three PNW species, while legacy pine/birch/oak
keys and binary indices remain stable for existing saves. Trunk dimensions,
stumps, camera blockers and canopy litter match the new stature. Trees taller
than 20 metres fall more slowly; both client and server share the timing.
Wood yield is unchanged and loot stays within seven metres of the tree base,
with the existing server checks keeping pieces out of water and obstacles.

## Consequences

Existing worlds gain the new art without a save migration or relocating trees.
This is stylized authored geometry, not a botanical scan or purchased pack.
The models are original repository assets, documented as CC0, and need no
third-party files. Screenshots show the actual shipped meshes; playtesting
still decides whether density and distant transitions feel right.
