# Climbing into a rowboat and rowing it

## Context

A rowboat can be built and moored (decision 0092) but nobody can use it. Chris chose: anyone can climb into any boat, you can only climb out at a shore, and a boat you leave stays where you left it. This change makes the boat go.

## Decision

**Rowing is a move, like sitting.** It is a new action kind (`ActionKind.Row`) that travels in the same action byte as every other move in a snapshot. While it is on, the feet follow `stepBoat` in `packages/shared/src/sim/rowing.ts` instead of `stepPlayer`. The browser runs the same function, so rowing is predicted and corrected like walking, and other players' boats are drawn from the same snapshots with no new message.

**Climbing in and out is the server's call.** A fresh press of E climbs in when a boat that nobody has is within 4.8 m of its middle and you are not fishing. The rider is put in the middle of the boat, facing the bow. E while rowing climbs out when the middle of the boat is no more than 3 m from a shore. You land 0.7 m inland of the nearest shore, which on an island is on the island. Further out, E does nothing. The press that boarded or climbed out never also gathers or eats. Reeds beside the boat are still cut first, because gathering comes ahead of boarding in the E order.

**Steering is like walking.** The bow turns toward where the rower points, relative to the camera, at 1.9 rad/s, and the boat only picks up speed as the bow comes round. 3 m/s, 4.2 with Shift, accelerating at 2 and gliding to a stop. The hull must stay at least 1.2 m from every shore (the same rule as mooring), so a boat that is rowed at the bank slides along it instead of running aground.

**While it is rowed, the rider is the boat.** The boat's place in the world is only updated when somebody climbs in or out; in between, the rider's own position is where it is. The server announces the boat's new place and saves it then, not every tick. A boat in use is marked with a flag on the built-piece list so the moored copy can be hidden while the one under the rider is drawn.

**Leaving the game, or being knocked out, while rowing** puts the boat ashore at the nearest bank (2.5 m out, lying along it) and the player on the bank beside it. The boat is never left in the middle of the lake with nobody in it, and a save never records a player standing on water.

## Consequences

One rider per boat. Boats do not bump into each other or a moored boat yet. The rider's arms hold still on their knees; the oars sweep on their own. Building is ignored while rowing, and so are swings and casts: fishing from the boat comes with the lake fish. Winter ice (Lake 3) will have to decide what happens to a boat and its rider when the lake freezes under them.

A crash or a deploy while rowing restores the boat to where it was last released, and the rider to the bank. The islands can now be reached. A boat left at an island stays there, and you may only have one, so a player who is knocked out on an island wakes in bed with their only boat across the water. Decision 0094 settles that: the boat falls apart where it lies, into half its materials, and they can build another.
