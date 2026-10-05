# 0097 · Steadier, more varied grass

## Context

Walking through the world, you could watch grass settle into place: tufts that hovered above low ground dropped onto it as you came near, tufts on hills rose out of the ground, and a ring of new tufts appeared at the far edge every few steps. The grass was also all one shape. Every clump was the same five blades at the same angle, differing only a little in height and width.

## Decision

**Steadiness.** Three causes, three fixes.

- The fade that shrinks grass to nothing at the far edge was shrinking each point's height above sea level rather than above its own clump's root. Low ground sat above that level, so its grass hovered, and hills sat below it, so their grass sank. It now shrinks each point towards its own root.
- Clumps were laid out only as far as they are drawn, from where you stood at the last layout, but the fade follows where you stand now. They are now laid out 5 m further than they are drawn, so everything you could see after a layout's worth of walking is already there.
- Laying out new ground made every new 12 m tile in one frame, a hitch of about 40 ms each time you crossed into a new row. Tiles for where you are heading are now made one per frame, ahead of need. In a walking test the worst frame fell from 42 ms to 6 ms.

**Variety.** Clumps are now six unlike blades (own height, width, curl and starting point) and each is turned to a random facing. Each also gets its own height, mostly short with a few tall (kept under about 0.7 m, so things lying in the grass stay findable), its own width, a slight lean, and a colour from lush to dry. Whole patches of the meadow grow taller or drier than others. Wind direction is still the same for every clump.

## Consequences

- About a quarter more clumps are drawn (the extra 5 m of layout), and each has six blades instead of five. A walking test at the busiest spot found 12,000 clumps at full density, well under the 24,000 cap.
- Grass is client-only and looks different from before; the world and the server are unchanged. The density slider works as it did.
- A unit test fails if the layout is ever pulled back inside the draw distance.
