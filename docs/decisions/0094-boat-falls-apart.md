# A boat cut off on an island falls apart

## Context

You may only have one rowboat (decision 0092), and a boat you leave stays where you left it (decision 0093). Put the two together and a player who is knocked out on an island wakes in bed with their only boat across the water and no way to build another. Chris chose that the boat should turn into a pile of materials, so the player can build a new one.

## Decision

**When:** a player is knocked out, and a boat of theirs that nobody is rowing lies where they cannot walk back to it. "Cannot walk back" is the nearest shore to the boat being an island's, not the mainland's (`nearestShoreIsIsland` in `world/lake.ts`, used by `landingBeside`). A boat on the mainland shore stays put: they can walk to it.

**What happens:** the boat is removed from the world and a pile of materials is left on the island's shore, 0.7 m inland of where the boat floated. Half of each cost, rounded down: 3 logs and 1 rope from 6 logs and 2 rope (`boatSalvage` in `sim/rowing.ts`, share in `world/boat.ts`). The pile belongs to nobody, so anybody can pick it up. The owner is free to build another.

**What it does not touch:** a boat somebody else is rowing (they can row home), a boat nobody owns, anyone else's boat, and a boat whose owner leaves the game rather than being knocked out. A rider who is knocked out while rowing is put ashore first (decision 0093); if that bank is an island's, the boat they were in falls apart too.

**How it reaches everybody:** the simulation hands the ids of broken boats to the game server (`drainBrokenBoats`), which deletes them from the saved built pieces and sends the built-piece list again. The browser already drops anything that is no longer in that list. The pile goes out and is saved like any dropped pile.

## Consequences

The loss is a few logs and a rope, not the boat: a knockout on an island costs about half a boat. The owner is not told that the boat has gone; they wake in bed and find out. A short note on waking is a possible follow-up. Boats are the only thing that breaks up this way. Demolishing built pieces in general, which would need to do the same clean-up, is not part of this change.
