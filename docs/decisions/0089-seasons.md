# Seasons

## Context

Chris wants the forest to change through the year, and the whole thing to feel epic: seasons that alter how the world looks and what there is to gather, hunt and fish, and eventually freeze the lake. Chris chose: two real hours per season, and all four kinds of change in play (gathering and hunting, fish, creatures, a freezing lake). Survival stays hunger and energy only, so there is no cold meter.

## Decision

The year is 24 game days, six to a season, in the order spring, summer, autumn, winter. Like day and night it is a pure function of the server's clock (`calendarAt(seed, nowMs)` in `packages/shared/src/sim/seasons.ts`), so there is nothing to save and no message to send: the server and every browser agree. A world's seed picks the day its year starts on, so worlds are not all in the same season at once. Days turn over at midnight.

The look eases between seasons over the last quarter of each one (a game day and a half, about half an hour) using `seasonMix`, so nothing jumps at midnight. The client holds one table of colours per season (`apps/client/src/art/season-look.ts`) that multiply onto the sky, sunlight, ground, grass and tree needles, plus an amount of snow. The ground and grass read a few shared shader values, and the tree materials are shared, so a season change recolours everything at once without rebuilding anything. The season tints daylight only: night stays exactly as dark as before.

Each season also has one thing drifting through the air: blossom petals, golden pollen, falling leaves, snowflakes (`apps/client/src/art/season-fall.ts` says how much of each, using the same easing). They are a small fixed pool of instanced shapes that follows the player, like the rain, so nothing is made or freed while playing, and they stay outdoors and stop for anyone who asks for reduced motion. In winter the snow takes the place of the rain streaks. All of it is look only: the server knows nothing about it.

`?season=winter` in the address shifts this one browser's calendar by whole days, so a season can be looked at without waiting up to six hours. On the real game it still changes only what that browser shows. Now that the lake freezes (decision 0095), the browser also sends it to the server, which uses it for the first one into an empty world and only on local, browser-test and preview servers, like test sign-in (decision 0086).

## Consequences

Everyone sees the same season, with no new saved state and no new message. The trees are evergreens, so they only warm or frost a little, and autumn's colour comes mostly from the ground and grass and the leaves in the air; coloured leaves on the trees themselves would need new tree models. Because the season is derived from wall-clock time, an empty world's calendar still moves on, the same as its day and night. Everything gameplay-related (what grows, which fish, how creatures act, the lake freezing) will read `calendarAt` and live in the data tables in `packages/shared/data`.
