# 0106 · The painting comes alive and follows the seasons

## Context

Chris wanted the painted valley behind the front page and loading screen to move a little and to show the time of year the game is in: autumn colours, light snow in winter, and so on. He chose to recolour the one painting and draw a few moving things over it, rather than paint four versions, and picked the movement: drifting mist, shimmering water, chimney smoke with a glowing cabin window, and a slow camera drift. Anyone who asks their computer for less motion should get a still picture.

## Decision

- **One painting, recoloured by the season.** `season-grade.ts` reads the painting once and shifts the colours of the leaves (greens to gold and red in autumn, a pale frosted blue in winter, fresher green and a little blossom in spring), with a soft lake map so the water can freeze without speckling the reflections. Summer is the painting as it was made. The result is cached, and a new look is only worked out when the season has moved a tenth of the way into the next (`mixKey`).
- **A little living world on top.** `backdrop-world.ts` keeps track of mist, chimney smoke, glints and ripples on the water, a lamp glow in the cabin window, and the falling things for the season: pollen and petals, leaves, snow. `backdrop-paint.ts` draws them on a canvas the size of the painting, about 30 times a second. The falling leaves and petals use the same colours as the ones in the game.
- **The game's own calendar.** `backdrop-clock.ts` uses the same calendar as the clearing (decision 0089), so the picture is already in the season the player is about to walk into. No world has its own seed yet and the page has no connection before entering, so it uses the default seed and the browser's clock. `?season=winter` (and the other three) works on the front page everywhere, as a way to look at a season.
- **One backdrop, shared.** The mist, leaves and recoloured painting live once (`shared-backdrop.ts`). Each screen only plugs its canvases in, so pressing Play or Back does not make everything jump back to the start, and the slow camera drift carries on from where it was.
- **It gives way first.** `pacing.ts` times each frame. A computer that keeps struggling is given fewer leaves and flakes, and if it still struggles, everything stops and the painting stays as a still.
- **The loading screen holds still.** We measured the game's load on a computer with no graphics card: the slow camera drift (a CSS animation over the whole window) made the game take about three times as long to load (25-32 s against about 9 s), where drawing the leaves and mist cost almost nothing. So the loading screen shows the recoloured painting and its mist, but not the camera drift.
- **Less motion means still.** With the "reduce motion" setting on, nothing moves: one frame is drawn, there is no drift and no glints on the water.
- **Browser tests** still use `skipDrawing` (decision 0100) where they do not look at the backdrop; four new tests cover it.

## Consequences

- The front page shows the season by the player's own clock, so someone in a different time zone may see a different day for a few hours around a season change. Once a world has its own seed, the page should ask for it.
- The recolouring is done on the player's computer the first time the page shows (a fraction of a second, done when the browser is idle), instead of shipping four paintings. A new season look means changing numbers in `SEASON_GRADES`, not painting.
- Changing the painting means checking that the chimney, window, lake and mist positions in `SPOTS` (`backdrop-world.ts`) still line up.
- The character screen (next change) stands in front of this same backdrop.
