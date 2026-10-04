# The lake

## Context

Chris wants a big lake with islands in it, a rowboat to cross it, and in winter a lake that freezes over so you can walk across. This first step is the lake itself: where it is, what it looks like, and the rules for the shore. The boat, the lake fish and the ice come in later steps and need the lake to be built so they can reach into it.

Chris chose: a lake about a hundred metres across in a corner of the world as it is now (300 by 300 metres, not a bigger world), with about five islands, roughly a half-minute row across.

## Decision

The lake sits in the north-east corner, the same in every world, like the pond. It is about a hundred metres across and well over eighty metres from the home clearing's tree line. `packages/shared/src/world/lake.ts` describes it as two sets of circles: five overlapping circles that make the outline of the water, and a few overlapping circles for each of five islands. Everything about it is worked out from those numbers: is this spot on the water, how deep is it, which way is the shore. So the server, every browser and the tests all agree, and nothing about the lake travels over the wire.

The pond is a few round walls. That cannot work here, because a wall round the lake would also wall off the islands, and later a boat has to be able to cross and the winter ice has to be walkable. So the lake has one shore wall of its own, in the collision rules the server and the browser both run (`lakeWall` in `collision/capsule.ts`). When it is up, anyone on foot is pushed straight back from the nearest shore, so they slide along the bank rather than sticking to it. It is a switch (`up`), so the boat and the ice can take it down without any new collision code.

The ground follows the water, in `wildernessHeightAt`: the hills ease down to a gentle beach over sixteen metres, the floor sinks a couple of metres away from the shore, and each island is a soft dome. The water is drawn as one flat sheet at the lake's level, and the islands simply poke through it. Nothing grows in the water or right at its edge; each island gets a few trees and rocks of its own, numbered after all the wilderness's existing ones so none of those change.

Things that only need to keep clear of the water (new gather patches, dropped items, raid starting points, build spots) treat the whole outline, islands included, as water. A rod can be cast onto the lake, and not onto an island. Encounter sites that would have landed in the lake or on its bank are skipped and the next try is used, so every other site stays exactly where it was.

## Consequences

A world's encounter sites and trees only change if they were in or next to the lake's corner; nothing else is touched, and there is nothing to save. The islands cannot be reached on foot, because the shore wall holds anyone back; they wait for the boat, and then for the one-island-at-a-time features Chris has planned. Anyone found standing in the water while the wall is up (when the ice thaws, say) is walked out to the nearest shore, which could be an island's; the freezing step will need to decide what should happen to them. The lake does not freeze yet, the water is drawn the same all year, and fish from it are the same as the pond's.
