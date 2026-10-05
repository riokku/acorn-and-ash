# Building and mooring a rowboat

## Context

Chris wants a rowboat on the lake, built at the shore from the build menu like a campfire, with a see-through preview first. He chose: six logs and two rope, one boat per player, anyone may climb into any boat, you can only climb out at a shore, and a boat you leave stays where you left it. This step is only building the boat and mooring it. Climbing in and rowing is the next change.

## Decision

A rowboat is an ordinary buildable (`rowboat`, added at the end of the buildable list, whose order is saved and sent over the wire) with two differences from the rest.

It floats instead of standing on level ground. The usual rules ask for the player's home building area, level ground, and no water under the piece. A boat skips all three. In their place `checkBuildSpot` asks about the lake: every point of the hull (the middle and eight points round its edge) must be at least 1.2 m from every shore, and the middle must be no more than 4 m out. The lake bed slopes gently, so 1.2 m out is about a hand's width of water under the boat and 4 m is still near enough to step into from the bank. `packages/shared/src/world/boat.ts` holds the two numbers. Because the rule measures the whole hull, a boat cannot be moored with its bow on the sand, and turning it along the bank lets it sit closer in than turning it out into the lake.

It can be built from anywhere on the bank, with no home. The cost is six logs and two rope, taken the same way as any other build, and the one-per-player cap uses the same check as a flower bed or a trophy.

The clumps of reeds that are cut for rope also keep boats off: they are added to the footprints a build is checked against, on the server and in the browser's preview, so a boat is never moored inside a clump.

On the screen, the boat is a placeholder hull (`apps/client/src/scene/rowboat.ts`) with the waterline at its local height 0. Wherever a built piece normally sits on the terrain, a boat sits at the lake's surface instead, and the preview's mouse ray is aimed at the water's surface instead of the bed under it.

## Consequences

A moored boat is saved with the rest of the world's built pieces and comes back as it was. Climbing in and rowing came next, in decision 0093, which keeps the boat in water at least this deep. Nobody collides with a moored boat. What happens to a boat when the lake freezes in winter is still to settle. The build menu's number keys still cover only the first six pieces, so the boat is reached by clicking.
