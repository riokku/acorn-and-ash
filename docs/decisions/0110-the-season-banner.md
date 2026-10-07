# 0110 · The season banner

**Status:** accepted · **Date:** 2026-10-07

## Context

The season only showed as a line of text in the debug panel ("Autumn, day 3 of 6"). Chris asked for the current season to be shown in the game and on the home screens, in the style of Northgard's banner: a dark plaque, a coloured stripe along the top, a round badge, "Year 2 · October" and an italic line of advice.

## Decision

- **One banner, two homes.** `hud/SeasonBanner.tsx` draws it and `hud/season-banner.ts` works out what it says from a `Calendar` (decision 0089). The game feeds it the calendar the server sends. The front page and character screen feed it `backdropCalendar`, the same calendar the painted backdrop follows (decision 0106), so the banner and the picture behind it always agree. `?season=` shows the first day of a season in both places.
- **What it says.** In the game, "Year N · Season" with the season in italics. We have no named months, so the season name stands where Northgard has the month. The year counts from 1 in each world. **On the home screens it says just the season**, with no year: no world is chosen there, so the calendar comes from the browser's clock, and that clock's year is a number like 62201. Showing it would be wrong, and showing "Year 1" would be a guess.
- **The stripe is the calendar.** It is cut into six pieces, one for each day of the season: days gone are bright, today glows, days to come are dim. Each season has its own colour and badge (sprout, sun, leaf, snowflake).
- **The advice line is honest.** Only the lake freezing changes how the game plays, so the lines are about the look of the forest, plus "The lake is frozen. You can walk across it." in winter. On the last day of a season the line turns to the next one ("You should prepare for winter." at the end of autumn). Nothing promises a harvest or a hardship the game doesn't have. When seasons start to matter in play, the lines should change with them.
- **Where it sits.**
  - In the game: top centre, like Northgard. The cache compass, raid banner and tracker, and sign-out countdown that used to hang from the top centre moved down by the banner's height (`--season-banner-space`).
  - On the home screens: the top-left corner, which the removed title left free; the middle of those screens is the title, the character and the card, and the gear holds the top right. On a short or narrow character-creation window there is no spare corner, so it is hidden there.
- **Kept the debug row.** The HUD panel's "Season" row stays, because the browser tests read it.
- **Not on the loading screen**, which already has its own mark. Easy to add if wanted.

## Consequences

- The home-screen banner looks at the clock once a minute, so a season change shows without a reload.
- The banner is always shown in the game while playing; there is no setting to hide it yet.
- Two worlds with different seeds can be in different seasons, but the home screens use the default seed, so they can disagree with a world's own calendar. The banner on the character screen shows the default calendar's season, not that world's, which is why it leaves the year out. The game's banner is always right for the world you are in.
