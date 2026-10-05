# 0100 · Browser tests skip the graphics card

## Context

Twenty of the older browser tests in `e2e/play.spec.ts` had been failing since the real tree, flower and pine models landed on 23–24 September, and the whole browser suite had been red ever since.

The tests were not wrong about the game. The browsers that run them, on a laptop or in GitHub, have no real graphics card, so the picture is drawn in software. With the full forest in view that takes 2.5 to 9 seconds per frame. The game never moves a player more than a quarter of a second per frame (so a slow computer cannot teleport anyone), which means a test that holds W for three seconds only walked about 7% of the way. Making the window smaller did not help (160 × 120 still took 2.5 seconds a frame) and neither did turning off shadows or grass. Skipping the draw calls brought a frame down to about 75 milliseconds and walking back to its normal speed.

A few tests had also gone out of date in ways that had nothing to do with speed:

- They read a "Carrying" line that the HUD no longer has.
- The helper that walks to the axe could stop next to the bag instead.
- The landmark "oak" is shown as a Sitka spruce now, so the tests asked for a hint and a name the game no longer uses.
- Every piece except a tent needs a building area, so building a campfire or a lantern in a new world needs a first tent (six sticks) first.
- Every forest tree can be chopped, so the first tree faced on the way to the oak is often a different one.
- Animals bolt between "in reach" and the next check, and a fox whose den sits at the world's edge can run out past the line the player may not cross.

## Decision

- **The old tests don't draw.** `play.spec.ts` stops the browser's draw calls before the page loads (`skipDrawing`). Everything else still runs for real: the game code, the network, the server and the HUD.
- **Two tests still draw for real**, tagged `@real-drawing`: "the game loads, connects and draws the clearing" and "the WebGL 2 fallback works when WebGPU is refused". A broken renderer is still caught there.
- **`ACORN_E2E_DRAW=1`** turns the skipping off for a whole run, for when real pictures or screenshots are wanted. Expect it to be slow on a machine without a graphics card.
- **Walking to something waits for that thing.** The helper that walks to a pickup now stops only when the item that is in reach is the one it wanted, so the bag next to the start no longer counts as the axe.
- **Checks use what the game knows.** Tests read the inventory through `acornDebug.carrying()` and the hotbar, not the removed "Carrying" line, and use the game's own tree names.
- **Building tests pitch the first tent.** The campfire and lantern tests gather six sticks and place a tent, then build the piece on the other side of the player, trying other directions if a rock is in the way.
- **Hunting tests chase in one loop.** They close in with the sprint held down, swing the moment a swing would land, and read the hint at that same moment. They pick the nearest animal of the right kind.

## Consequences

- The browser suite can be trusted again: a red result now means something changed in how the game behaves.
- Screenshots the tests save are blank unless `ACORN_E2E_DRAW=1` is set. The two tagged tests are what guard drawing, so a rendering problem in a scene they do not look at would be seen by eye, not by the suite.
- New tests in `play.spec.ts` get this for free. Specs that use their own fake server (`woodland`, `fishing-collection` and the like) draw as before.
