# Field journal stag goal

The Old Cedar Stag planner now uses the journal's paper, warm ink, fir actions
and copper focus. Existing painted coat and material art accompanies the
unchanged reward details and recipe. Rarity keeps its purple accent.

The pinned goal is a compact paper note. In taller windows it sits below the
connection panel, moving beside party health cards when they appear and below
the soul-storm warning when necessary. In shorter windows it sits below the
minimap, with a narrower variant beside the storm warning. The gallery keeps
the tracker in its ordinary document flow.

Progression, pin storage, recipe counts and every status remain unchanged.
The planner keeps uncapped ingredient counts and plural labels; the
tracker keeps its capped counts and original joined text. Neither view truncates
the next step or adds internal scrolling.

In short windows, three or more pickup notices temporarily take priority over
the goal. The tracker stays mounted and its pin stays saved, including while
notices fade. It returns with the same progress when the stack shrinks. Two long
notices and taller-window layouts leave it visible.

## Rendered review

Matched captures use the actual React HUD over a fixed game frame with controlled
sample state. They include deliberately crowded combinations of party health,
the longest homecoming receipt, ward guidance, map controls and lower feedback.
They do not certify online authentication or persistence. No new runtime assets
or effects are required; documentation images use quality-92 WebP.

| View                               | Before                                                                             | After                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Planner                            | [Before](../previews/field-journal-stag-goal/before-plan-ready.webp)               | [After](../previews/field-journal-stag-goal/after-plan-ready.webp)               |
| Extra materials and keyboard focus | [Before](../previews/field-journal-stag-goal/before-plan-excess-focus-narrow.webp) | [After](../previews/field-journal-stag-goal/after-plan-excess-focus-narrow.webp) |
| Homecoming at 900 × 600            | [Before](../previews/field-journal-stag-goal/before-recap-narrow.webp)             | [After](../previews/field-journal-stag-goal/after-recap-narrow.webp)             |
| Party and storm at 1366 × 768      | [Before](../previews/field-journal-stag-goal/before-storm-party-recap-wide.webp)   | [After](../previews/field-journal-stag-goal/after-storm-party-recap-wide.webp)   |
| Party and storm at 900 × 600       | [Before](../previews/field-journal-stag-goal/before-storm-party-recap-narrow.webp) | [After](../previews/field-journal-stag-goal/after-storm-party-recap-narrow.webp) |

Additional states: [missing hide](../previews/field-journal-stag-goal/after-plan-missing.webp),
[carried coat](../previews/field-journal-stag-goal/after-plan-carried.webp),
[worn coat](../previews/field-journal-stag-goal/after-plan-worn.webp), and
[focused tracker dismissal](../previews/field-journal-stag-goal/after-tracker-unpin-focus-narrow.webp).

Pickup feedback: [notice priority](../previews/field-journal-stag-goal/after-pickup-priority-narrow.webp)
and [restored goal](../previews/field-journal-stag-goal/after-pickup-goal-restored-narrow.webp).

Controlled checks passed for all six progression states, exact text/counts,
keyboard pin/unpin, recipe icon size, existing panel/map/chest restrictions,
pickup priority and fading, saved-pin preservation and progress restoration.
At both tested sizes, the tracker cleared the map, connection details, party
cards, storm with ward guidance, homecoming receipt, vitals, feedback and board
button. Astra approved the final code and rendered results.

The crowded captures also expose overlap between the receipt and storm banner,
and between party health and connection details. The later [HUD priority pass](field-journal-hud-priority.md) resolves those
collisions; the checks recorded here cover the pinned goal.

All three existing progression/pin unit tests passed. The two existing hunt and
gallery browser cases passed, including real-input hunting, coat crafting and
wearing. The new real-game HUD regression passed at both window sizes with
encoded party, storm, homecoming and inventory events, including saved-pin and
progress checks after pickup notices expire. Client and browser-test TypeScript,
scoped lint/formatting, diff checks and the client build passed.
