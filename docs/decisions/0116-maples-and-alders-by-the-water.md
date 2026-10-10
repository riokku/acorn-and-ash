# 0116 · Big-leaf maples and red alders grow by the water

## Context

The new broadleaf trees (decision 0115 covers the conifers they sit beside) needed a place in the world, and a way to behave through the seasons that sets them apart from the evergreens.

## Decision

- Two new tree kinds, `maple` and `alder`, are added to the end of the prop list. The numbers saved worlds and the network already use for pine, birch, oak, rocks and stumps do not move.
- World generation is unchanged in where it puts trees and in every random draw. After a spot has been given a conifer, `broadleafOrConifer` (`packages/shared/src/world/broadleaf.ts`) may swap it: alders within 14 m of the lake or stream (three in four), maples between 14 and 48 m from the water (one in two). Ground above 8 m and mountain ground keep their conifers. The home clearing and the islands are untouched.
- Both kinds are `deciduous`. Their leaves turn gold in autumn, drop in winter (only bark and branches show) and return in spring. The conifers keep the old seasonal tint.
- Chopping, stumps and falling use the same rules as other trees, with the maple at 4 swings and 3 logs, and the alder at 3 swings and 2 logs.

## Consequences

- In existing worlds, some trees beside the water change from a conifer to an alder or maple. Which trees are down is saved by number, so nothing else moves.
- Leaves hide by switching their shared material off, so winter costs nothing per tree.
- The leaf colour in autumn is shared by both species for now; separate colours would need a material per species.
