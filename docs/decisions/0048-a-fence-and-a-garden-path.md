# 0048. A fence and a garden path stone

**Status:** accepted · **Date:** 2026-09-26

## Context

Chris asked for more decoration options, with real art to follow once he
finds it. The last time this door opened (0023) it added a flower bed and a
lantern - both personal, one-of-a-kind pieces, each capped at one per
player. This round asked for something different in kind, not just in
number: a fence and a garden path are only decorations at all once several
of them stand together, so the existing "one per player" shape would have
made both useless - a single fence post decorates nothing.

## Decision

**Both are uncapped, like the campfire - the first personal-decoration
precedent to break that mould.** `BuildableKind.capPerPlayer` is `false` for
both, so a player places as many as they can afford, one at a time, the same
way the campfire always could. Nothing about the cap mechanism itself
changed; these two simply don't opt into it, the same "a new buildable is a
new data row" story 0023 already told.

**Priced low per piece on purpose.** A fence segment costs two logs, a
path stone two sticks - roughly a third and a half of the flower bed's own
six-flower cost respectively - because the real cost of either is however
many a player places in a row, not the cost of one. Logs for the fence (a
wood piece, and the same resource the campfire and cabin already use);
sticks for the path stone, the same no-tool-needed resource flowers and a
first axe already are, so laying a trail never waits on finding or making
one.

**No new resource, no snapping, no grid.** Both still place through the
exact same aim-and-press build flow as everything else - wherever the player
stands and looks, `BUILD_DISTANCE` out, blocked only by the usual footprint
and tree-line checks. A tidy, seamless fence line is up to a player's own
aim, not something the game enforces; that is a placeholder-art-and-
mechanic problem to revisit if it turns out to matter once real models
exist, not something worth solving for a placeholder box.

**Placeholder shapes, not placeholder mechanics.** The fence is two posts
and a pair of rails between them; the garden path is one flattened,
randomly rotated and sized stone, so a trail of them doesn't read as one
shape stamped down repeatedly. Both wait on Chris finding real art, the same
as the lantern still does.

**`CRAFT_KEYS` grew from four entries to six.** The build menu shares its
number keys with the craft menu (only one is ever open at once), and four
buildable kinds had already claimed all four. Six buildable kinds now fits
inside the same six the hotbar already uses, so nothing about the key
layout is new to a player, just how many of them the build menu happens to
use today.

**No new browser test.** Everything that actually needed proving live -
the build menu opening, a digit key placing the aimed kind, cost getting
spent, `builtProps` reflecting it - was already proven by the campfire and
lantern tests, and neither of those code paths changed here at all: only
the data table grew. 0023 made the same call for the flower bed's own cost
and cap, for the same reason. Cost, the missing per-player cap, and a
refusal when too poor are all covered at the shared-simulation layer
instead. The one live addition is a check that the build menu's journal
panel actually lists six entries, including "Fence" and "Garden path" by
name, in `e2e/play.spec.ts` - along with a fix to two assertions there that
were still checking for the old plain-text buildable listing the field-
journal redesign (0043) replaced with the panel itself, a pre-existing
mismatch this PR happened to notice while touching the same test.

## Consequences

- A fence line or a garden path is exactly as tidy as the player's own aim
  makes it - there is no snapping or grid to keep segments even.
- Two more buildable kinds without any new server logic, wire format
  change, or UI code - the fourth time running that "content as data" has
  paid for a new decoration with a handful of rows rather than a feature.
- The build and craft menus can now show up to six choices; a seventh would
  need `CRAFT_KEYS` to grow again.
