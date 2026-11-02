# Loading tips and journal tabs

The loading screen now has a quiet, paper-well trail tip after its existing
progress status. It is a stable 116 px card: the painted icon and short copy
can change without moving the progress bar or the rest of the screen. The
button advances only when selected, and every connection or loading error takes
priority over the card.

The field journal keeps its words as the primary navigation labels. Small
painted markers help scan the familiar pages: axe for Crafting, journal for
Discoveries, map for Expeditions, perch for Fishing, and flower for Garden.

| View                         | Before                                              | After                                             |
| ---------------------------- | --------------------------------------------------- | ------------------------------------------------- |
| Loading screen at 1366 × 768 | [Before](../previews/loading-tips/before-wide.webp) | [After](../previews/loading-tips/after-wide.webp) |

Open `/?gallery=loading-tips` for a read-only preview of the real loading
screen. Add `&state=error`, `rejected`, `offline`, `elsewhere` or `deleted` to
inspect the original problem states. The preview does not join or change a
world.

## Verification

The loading preview was compared before and after at 1366 × 768, 900 × 600,
600 × 600 and 900 × 480. Existing status text, progress values, retry behavior
and journal labels matched exactly. The four tips retain card and progress
positions at all full-height review sizes; the card is hidden at 900 × 480.
Browser coverage checks keyboard cycling, error priority and compact physical
tab clicks.
