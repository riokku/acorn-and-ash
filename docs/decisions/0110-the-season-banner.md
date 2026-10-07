# 0110 · The season banner and the season ring

**Status:** accepted · **Date:** 2026-10-07

## Context

The season only showed as a line of text in the debug panel ("Autumn, day 3 of 6"). Chris asked for the current season to be shown in the game and on the home screens, in the style of Northgard's banner: a dark plaque, a coloured stripe along the top, a round badge, the season and an italic line of advice.

That went in first as one banner, at the top centre of the game. After playing it Chris asked for the in-game version to be much smaller and out of the way, then for it to become a ring round the minimap: no year, no words, an icon for the season, the segments kept, progress running clockwise, the current segment flashing a little, and the season and day on hover. The ring should sit on the minimap's border and not cover much of the map. A first ring had one piece for each day of the current season; Chris then asked for the **whole year** in the ring, colour coded to the season, with the icon on the current season. This record is how things stand after that.

## Decision

- **Two looks, one calendar.** The home screens keep the banner (`hud/SeasonBanner.tsx`): a plaque in the top-left corner with the season's name and a line of advice. The game uses a ring round the minimap (`hud/SeasonRing.tsx`). `hud/season-banner.ts` works out what both say from a `Calendar` (decision 0089). The game feeds it the calendar the server sends. The home screens feed it `backdropCalendar`, the same calendar the painted backdrop follows (decision 0106), so the banner and the picture behind it agree. `?season=` shows the first day of a season in both places.
- **No year anywhere.** In the game Chris did not need it. On the home screens it would be wrong: no world is chosen there, so the calendar comes from the browser's clock, and that clock's year is a number like 62201. (`seasonBannerView` can still print "Year N · Season" for a world's calendar; nothing asks it to.)
- **The ring is the year.** It has one piece for each of the year's 24 days (`hud/season-ring.ts` works out the arcs), filling **clockwise from the top**. Spring takes the first quarter, then summer, autumn and winter, six pieces each. Every piece is in its own season's colour (spring green, summer yellow, autumn orange, winter blue): days gone are bright, today pulses gently (it holds still if the player has asked for reduced motion), days to come are dim but keep their colour, so the whole year can be read at a glance. A slightly wider gap between seasons than between days makes the four read as four. The colours are shared with the home-screen banner, so a season is the same colour everywhere.
- **Where the ring goes.** Just outside the map's own rim: the map is 188px across and the ring runs from 94 to 99px out from its middle, so none of the map is covered. It is drawn inside the minimap's box, so the two always line up, and it comes and goes with the minimap (gone while the big map or a chest is open). It is above the map, so it covers the outermost pixel of the little N that swings round the rim; the N is otherwise clear.
- **The badge.** A small round badge with the current season's icon (sprout, sun, leaf, snowflake) sits just outside the ring, in the middle of that season's quarter. It moves a quarter of the way round each time the season changes, so it is always next to the pieces it belongs to. Outside the ring it covers none of the map and none of the ring, and it keeps clear of the N that swings round the rim.
- **Words only on hover.** Pointing at the badge or at the ring shows "Autumn · Day 3 of 6" (the day is the day of the season, not of the year: that is what the player counts). A wider invisible band over the ring makes it easy to hit. Screen readers get the same words as a label.
- **The zoom buttons moved.** The +, − and M buttons used to sit on the minimap's rim at the lower right, where they would have hidden part of the ring. They are now a row under the map.
- **The advice line is honest, and only on the home screens.** Only the lake freezing changes how the game plays, so the lines are about the look of the forest, plus "The lake is frozen. You can walk across it." in winter. On the last day of a season the line turns to the next one. Nothing promises a harvest or a hardship the game doesn't have. When seasons start to matter in play, the lines should change with them.
- **Kept the debug row.** The HUD panel's "Season" row stays, because the browser tests read it.
- **Not on the loading screen**, which already has its own mark.

## Consequences

- The top centre of the game is free again, so the cache compass, raid banner and tracker, and sign-out countdown are back where they were before any banner.
- The home-screen banner looks at the clock once a minute, so a season change shows without a reload.
- There is no setting to hide the ring yet.
- The ring's size and place are written in the CSS next to the minimap's own size, which is also written in `Minimap.tsx`. If the minimap changes size, the ring has to move with it. A browser test checks that they stay centred on each other.
- Two worlds with different seeds can be in different seasons, but the home screens use the default seed, so they can disagree with a world's own calendar. The home banner shows the default calendar's season, not that world's. The ring in the game is always right for the world you are in.
