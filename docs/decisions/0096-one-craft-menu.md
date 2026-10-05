# 0096 · One Craft menu

## Context

There were two menus for making things. **Craft** (`C`) listed what you make by hand and carry: tools, meals, rope. **Build** (`B`) listed what you place in the world: a campfire, a tent, a fence, a rowboat. Chris could not tell which one held what, and rope was never in the one he opened. Rope was also hard to find in Craft: it was the ninth recipe, the panel had no height limit of its own, and on a laptop screen the bottom of the list ran off the screen with nothing to say there was more.

## Decision

- One **Craft** menu lists everything, on one page of the field journal. `C` opens it, and so does `B` outdoors. Indoors, `B` still opens the room's own decorating panel, which has pieces of its own.
- Entries are sorted into groups: Tools, Food, Home, Camp & lighting, Garden & boundaries, Lake, Trophies. Within a group, what you make by hand comes before what you place. Rope sits with the lake, since it is for the boat.
- Tabs along the top show **All** or one group at a time. The garden group's tab is called **Yard**, so it never reads like the journal's own Garden page, where you plant.
- The title, the journal tabs and the group tabs stay in place; only the list scrolls.
- Number keys `1`–`9` pick the entry with that number **on the page showing**, so `C`, `Lake`, `1` makes rope. Every entry can also be clicked. Picking something you make leaves the menu open for the next one; picking a piece to place closes it and starts the preview, as before.
- The panel and the keys both read one list (`apps/client/src/hud/craft-menu.ts`), so a key can never do something different from what the entry beside its number says.
- The home's building boundary shows while the menu is open on a page that lists pieces to place (not Tools or Food), and while a piece is out.

## Consequences

- The old shortcuts change: `B`, `1` no longer starts a campfire. It is now `B`, **Camp**, `1`, or a click. This is slower for one key press and clearer to read; if Chris misses the old speed, a "recently used" row is the next thing to try.
- Only nine entries get a number on any page, so the **All** page reaches the first nine tools and meals by key and the rest by click or by choosing their tab. The Lake page is short enough that its two entries are both keys.
- The server is untouched: crafting and placing use the same messages as before.
- Playwright tests that opened the Build menu now pick a page and then a number, or click an entry by name.
