# Seasons

## Context

Chris wants the forest to change through the year, and the whole thing to feel epic: seasons that alter how the world looks and what there is to gather, hunt and fish, and eventually freeze the lake. Chris chose: two real hours per season, and all four kinds of change in play (gathering and hunting, fish, creatures, a freezing lake). Survival stays hunger and energy only, so there is no cold meter.

## Decision

The year is 24 game days, six to a season, in the order spring, summer, autumn, winter. Like day and night it is a pure function of the server's clock (`calendarAt(seed, nowMs)` in `packages/shared/src/sim/seasons.ts`), so there is nothing to save and no message to send: the server and every browser agree. A world's seed picks the day its year starts on, so worlds are not all in the same season at once. Days turn over at midnight.

The look eases between seasons over the last quarter of each one (a game day and a half, about half an hour) using `seasonMix`, so nothing jumps at midnight. The client holds one table of colours per season (`apps/client/src/art/season-look.ts`) that multiply onto the sky, sunlight, ground, grass and tree needles, plus an amount of snow. The ground and grass read a few shared shader values, and the tree materials are shared, so a season change recolours everything at once without rebuilding anything. The season tints daylight only: night stays exactly as dark as before.

`?season=winter` in the address shifts this one browser's calendar by whole days, so a season can be looked at without waiting up to six hours. For now it changes only what that browser shows. When seasons start changing gameplay, the server has to be told too, and that switch must work only on local and preview addresses, like test sign-in does (decision 0086).

## Consequences

Everyone sees the same season, with no new saved state and no new message. The trees are evergreens, so they only warm or frost a little, and autumn's colour comes mostly from the ground and grass; real autumn leaves, falling leaves, snowfall and blossom are a later step. Because the season is derived from wall-clock time, an empty world's calendar still moves on, the same as its day and night. Everything gameplay-related (what grows, which fish, how creatures act, the lake freezing) will read `calendarAt` and live in the data tables in `packages/shared/data`.
