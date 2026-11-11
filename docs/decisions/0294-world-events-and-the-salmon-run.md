# 0294. World events, and the salmon run

**Status:** accepted · **Date:** 2026-11-10

## Context

Chris asked for shared world events as one of the touches that make the world
feel like a big online game. Asked directly, he chose the salmon run first;
events that give a gentle bonus from things already in the game, with nothing
new to collect; a banner as one begins plus a reminder while it runs; and
events that are rare and seasonal, about one to a season.

## Decision

- **An event is read off the calendar.** `packages/shared/src/sim/world-events.ts`
  holds a small table: each event has a season, the day it begins and how many
  days it lasts. The server and every browser work out what is on from the
  same calendar they already share, so no message starts or ends one and
  everyone sees it begin together. Nothing new is saved.
- **The salmon run is the first two days of every autumn.** A fixed place in
  the year, not a roll of the dice, so players can look forward to it and so
  `?season=autumn` on a preview starts a world in the middle of it.
- **The bonus is better fishing on Mirrormere.** While the run is on, a line
  cast into the lake bites in seven-tenths of the usual time and brings up
  the same fish with the good ones likelier: trout from three in ten to nearly
  half, a golden carp from one in ten to one in four. The server decides this
  when the line is cast. The home pond fishes as ever, so the run is a reason
  to walk to the lake. There is no salmon item: the salmon are what you see.
- **The salmon are scenery, the same for everyone.** Each game draws them from
  the shared clock: swimmers every six or seven metres up the whole of the
  Alderwash, leapers at each of its five waterfalls (about six in ten clear
  the fall, the rest drop back), and a shoal turning at the river's mouth. One
  Blender model (`tools/art/salmon.py`, `assets/critters/salmon.glb`, 206
  triangles), drawn from one pool of at most 72 within 70 m. With reduced
  motion on they hold still and none leap.
- **Announced, then kept in view.** A banner in its own colour with four
  rising notes as the run begins, and again as it ends. Arriving part-way
  through shows the opening banner too. While it runs, the minimap names it
  under the region with the real minutes it has left. An event's banner waits
  its turn behind a place name.

## Consequences

- Another event is one more row in the table plus whatever it shows and
  changes. The banner, the reminder and the calendar check are already there.
- A world that nobody visits in early autumn misses that year's run; the next
  comes round in a year, which is eight real hours of play.
- Because the run is fixed to the calendar, it cannot be made rarer or moved
  without changing when players expect it.
- The fishing bonus is deliberately modest and uses only existing fish, so it
  cannot unbalance anything. The numbers are a first guess to tune by play.
- Bears do not come to the river for the salmon. They could, later.
