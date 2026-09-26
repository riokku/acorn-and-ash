# 0043. A field journal for crafting and carrying

**Status:** accepted · **Date:** 2026-09-26

## Context

Playing the new hotbar icons (0042) on staging, Chris asked for something
bigger: pull the craft and build menus out of the debug stats panel
entirely, and give both the inventory bar and the crafting screen a design
pass that felt like part of the game rather than a developer readout. He
wanted to see design options before committing to one.

Three directions went up as a design canvas, each carrying the same real
icons and data, applied to the hotbar and to a mocked-up craft panel:

- **Wooden Toolbelt** - rustic wood, leather and brass, a plank-textured
  recipe board.
- **Field Journal** - the Home screen's own warm parchment palette
  (decision 0038), recipes as journal entries, a serif hand for names.
- **Refined Glass** - the smallest change: keep the exact dark glass the
  hotbar already used, just give craft and build their own panel instead
  of a text row in the stats.

Chris picked the Field Journal.

## Decision

**Craft and build are now their own panel, never a row in the stats
box.** The stats panel (`.hud-panel`) goes back to being only connection
and debug information - Server, Players, Ping, Tick, Renderer, FPS,
Position, Correction, Time, Hunger, Health. `Crafting`/`Building`, the two
plain-text components that used to render inside it, are gone; a shared
`JournalPanel` component takes their place, rendered as its own
overlay, positioned above the hotbar, open exactly when `craftMenuOpen` or
`buildMenuOpen` already says.

**One shape, two callers.** `craftEntries`/`buildEntries` each turn the
real data (`RECIPE_ITEMS`/`recipeFor`, `BUILDABLE_KIND_ORDER`/
`BUILDABLE_KINDS`) into the same small `RecipeEntry` shape - an index, an
icon, a name, its costs, and whether it's affordable right now
(`roomFor`/`canAfford`, unchanged) - so `JournalPanel` itself only ever
draws one thing: a stamped icon, a serif name, a row of ingredient icons
each with their own count, and a Ready/Need-more mark. Craft and build
were always structurally identical (a numbered list of options with a
cost); this makes that explicit instead of keeping two near-duplicate
render functions.

**Every ingredient gets its own icon**, not just the thing being made.
`ItemIcon` already existed for the hotbar (0042); the panel reuses it
for a recipe's costs directly, small and tinted a muted ink-brown rather
than each item's own colour, so a card reads as "the recipe" first and
"6 sticks, 2 logs" second. Buildables needed icons of their own for the
first time - `campfire`, `cabin`, `flowerBed` and `lantern` - so the icon
module's shape registry grew from items alone to `ItemId | BuildableKindId`,
behind two thin exports (`ItemIcon`, `BuildableIcon`) sharing one
underlying registry and renderer, rather than a second copy of the same
component.

**The hotbar became wax-seal circles on a parchment strip**, the same
palette the journal panel and the Home screen (0038) already share -
`--parchment`, `--parchment-dim`, `--ink-warm`, `--ink-warm-dim`,
`--accent-warm`, added once at `:root` rather than duplicated in both
places. The slot key moved from a corner label to a small circular badge
overlapping the edge, tinted the same warm accent a slot's ring already
uses for "usable" or "equipped" - matching the concept exactly. Only the
CSS changed here; the JSX `HotbarSlot` already produced, it just draws
differently now.

**The bottom hint line got shorter, not longer.** `craftMenuHint`/
`buildMenuHint` used to spell out every choice by name ("Press 1 for an
axe, 2 for a fishing rod - or C to cancel"), because that was the only
place those choices were visible at all. Now the panel itself shows every
option, so the hint's whole job shrank to "how do I close this" -
`'Pick one below, or C to close'`. The per-item grammar helper
(`withArticle`, "an axe" vs "a lantern") had no other caller left, so it
was removed along with the sentence-building code, not kept as dead
weight.

**Scope stayed exactly what Chris asked for.** The debug stats panel, the
bottom hint pill and the "what just happened" news pill all keep their
original dark glass - none of those were named, and mixing a warm
illustrated craft panel into an otherwise-technical debug readout is a
deliberate, visible line between "diagnostic overlay" and "the game",
not an oversight.

## Consequences

- Confirmed by eye before shipping, the same way the icon set was: a
  static page loading the real `styles.css` next to hand-built markup
  matching what the JSX actually produces, screenshotted directly - no
  game server needed for a check that is really about CSS and layout,
  not simulation.
- The three design concepts and the "current, for reference" comparison
  live on their own canvas artifact from this conversation, not in the
  repo - this doc is the durable record of which one was picked and why.
- A recipe or buildable with more than a couple of ingredients has not
  been tried against this layout - every one that exists today costs at
  most two kinds of thing. Worth a look once a pricier recipe exists.
- Buildable icons are a first guess, the same as every placeholder shape
  in this game before real art replaces it - nobody has looked at them
  outside this pass's own quick preview.
