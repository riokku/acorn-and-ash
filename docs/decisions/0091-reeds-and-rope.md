# Reeds and rope

## Context

The rowboat Chris wants is lashed together with rope, and rope has to come from somewhere in the world. Chris chose: cut reeds at the lake, about three reeds to a rope, and the reeds grow back. This step is only the reeds and the rope; the boat comes next.

## Decision

Reeds are gathered by hand like sticks and flowers, so they use the patch rules that already exist (decision 0061): a patch holds two to six reeds, one is cut per press of E, a patch cut bare is empty for three minutes, then grows back to twice its old stock. They do not use a new system.

Two things differ from a stick patch. First, reeds are rooted, so a bare patch grows back where it stood instead of turning up somewhere else. Second, the places are not chosen by the world's seed: `packages/shared/src/world/reeds.ts` walks the open bank of the lake and puts a patch about every 34 metres, in water about half a metre deep (close enough to reach from the shore without wading). The lake is the same in every world, so these six places are too, and the server only ever says how many reeds each one has left, as it does for every other patch.

Patch ids are one byte on the wire. The clearing uses 1 to 4 and the forest's berries and mushrooms start at 200, so the reeds take 100 and up (`REED_PATCH_FIRST_ID`). Old saves load unchanged: patches the save does not know are simply fresh, and ids it has that the game no longer knows are ignored.

Three reeds make one rope, crafted by hand with no station (the craft menu, key `C`). `reed` and `rope` are added at the end of the item list, because that list's order is saved and sent over the wire. The scenery reeds along the shore leave a gap round each cuttable patch so the two never overlap.

## Consequences

The craft menu's number keys cover nine recipes and rope is the ninth. The next recipe will only be reachable by clicking until the key list grows. Rope has no use yet; it waits for the rowboat. Reeds are not seasonal yet: they grow all year, and the winter freeze will have to decide whether a patch stays cuttable through ice.
