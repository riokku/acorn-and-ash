# Field journal outings and homecoming

Expedition offers, chosen outings and preparation advice now use the journal's
parchment, warm ink, fir actions and copper focus marks. Thin inner borders keep
the advice quiet. Existing painted item art accompanies rewards, suggested meals
and gathered finds, while their names and quantities remain visible.

The “Home again” receipt uses the same paper with a narrow fir binding. It sits
below the minimap on taller screens and beside it on shorter screens, leaving the
region label, map controls, cache compass, expedition-board button and lower
feedback clear. It keeps the first four gathered entries in their original order,
the overflow count, discoveries, keyboard dismissal and 14-second lifetime.

Outing objectives, timing, saved progress, preparation shortcuts, claim rules and
backpack-full advice retain their behavior. Rumor rewards remain sealed until
the trail is complete; unread clues remain hidden. Preparation is still optional.

## Rendered review

These matched captures use the actual React HUD over a fixed game frame with
controlled sample state. They show presentation and local interactions rather
than online authentication or persistence. No new runtime assets or effects are
required. Documentation captures use quality-92 WebP.

| View                         | Before                                                                      | After                                                                     |
| ---------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Completed outing and rewards | [Before](../previews/field-journal-journeys/before-board-ready.webp)        | [After](../previews/field-journal-journeys/after-board-ready.webp)        |
| Preparation at 900 × 600     | [Before](../previews/field-journal-journeys/before-preparation-narrow.webp) | [After](../previews/field-journal-journeys/after-preparation-narrow.webp) |
| Homecoming at 900 × 600      | [Before](../previews/field-journal-journeys/before-recap-narrow.webp)       | [After](../previews/field-journal-journeys/after-recap-narrow.webp)       |

Additional views: [offer actions](../previews/field-journal-journeys/after-board-offer-actions.webp),
[collected clues](../previews/field-journal-journeys/after-rumor-clues.webp),
[revealed rumor](../previews/field-journal-journeys/after-board-rumor-complete.webp),
[discovery-only receipt](../previews/field-journal-journeys/after-recap-discovery.webp),
[full HUD feedback](../previews/field-journal-journeys/after-recap-feedback.webp), and
[keyboard claim focus](../previews/field-journal-journeys/after-claim-focus-narrow.webp).

Controlled browser checks covered offer selection, claim and disabled states,
all three preparation shortcuts, rumor reward privacy, collected clues,
reachable narrow-window actions, keyboard claim/dismiss, the four-find limit
and the unchanged timeout. At both 1366 × 768 and 900 × 600 the full receipt
fit without scrolling or intersecting the minimap, cache compass, board button,
hotbar or lower feedback. Astra approved the final code and rendered results.

The 12 existing homecoming, preparation and rumor presentation unit tests passed.
Client and browser-test TypeScript, changed-file lint/formatting, diff checks and
the client build also passed.

All five existing browser regressions passed against the built client with a
local simulation and controlled session responses: meal preparation, food/gear/
pack shortcuts, choosing and claiming outings, repeated home transitions with
recap dismissal, and following a rumor through its recovered find. These checks
do not certify online authentication or persistence.
