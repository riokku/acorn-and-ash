# The lake freezes in winter

## Context

The lake is where the rowboat goes (decisions 0090–0094), and seasons turn on the world's clock (decision 0089). Chris chose that the lake freezes in winter: you can walk on it, you can't row on it, and a boat that is out on the water when the ice comes freezes where it is, stuck until spring.

## Decision

**When:** all of winter, from its first morning to the first morning of spring (`lakeIsFrozen` in `sim/seasons.ts`). The server works it out from the world's own clock once a second and tells every browser with one small message, `LakeIce` (`encodeLakeIce`), on joining and whenever it changes. No browser works it out for itself, so nobody's own clock can disagree.

**What the ice is:** the lake's bed is replaced, for walking, by a flat sheet at the height of the shore (`lakeIceHeight` in `world/lake.ts`). Switching the shore's wall off and the sheet on is one call, `setLakeFrozen` (`collision/capsule.ts`), made by the server's simulation and by the browser on the same message, so walking out on the ice is predicted the way it is decided. Islands and the mainland are unchanged.

**Boats:** a frozen boat can't be climbed into, and a new one can't be moored (`'frozen'` in `sim/building.ts`; the build preview says so). A boat that somebody is rowing when the lake freezes stays exactly where it is, nobody is in it any more, and the rower is put on the ice 1.4 m beside it. Everybody is told about the boat the same way as for any climb in or out. The boat is saved there and floats again in spring. A boat cut off on an island does not fall apart in winter (decision 0094): it is frozen, not lost.

**Casting:** no line is cast onto the ice. The lake counts as no water at all while it is frozen.

**Thaw:** anybody still out on the lake when spring comes is put on the nearest shore without being woken, stood up or interrupted. The same goes for somebody who logged out on the ice and comes back after it has thawed.

**Testing:** `?season=winter` on your own machine or a preview used to change only what one browser showed. Now the browser also sends it with its connection, and the server honours it only for the first one into an empty world, and only where `WORLD_ALLOW_TEST_SEASON` is `1` (local, the browser tests and previews, never staging or production). The web Worker also drops it unless the address is a local or preview one. To see winter on a preview, use a new world name so nobody is already in it: `?world=winter-test&season=winter`.

## Consequences

Chris can try the whole thing on a preview in a couple of minutes instead of waiting six hours for winter. The ice is drawn as a pale sheet over the water; the minimap and the big map still show open water, and the camera still ignores the ice when it pulls in. Boats don't bump into each other, so a frozen boat can be walked through. One rider per boat is unchanged. When fish live in the lake, winter will have to say what happens to them and whether you can fish through the ice. Neither is decided here.
