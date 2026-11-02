# Field journal HUD priority

Connection and cooperative status now use the quiet fir material, warm type,
thin borders and copper keyboard focus used throughout the redesigned HUD.
Connection status stays visible. Native Connection details preserve every
existing diagnostic label and value in a keyboard-scrollable region.

Connection, nearby players and vitals share one bounded column. Self-rescue
stays above the scrollable player list, which keeps its eight-player cap,
meal-sharing priority, full names, health, rescue progress and action guidance.
Vitals reserve their actual height, including cold warnings. Narrow windows
use a smaller party column so boss and storm banners have clear space.

The homecoming receipt defers during urgent combat, storm, raid, victory and
rescue messages, or while loading, maps, storage, menus or settings take
priority. Its keyed component retains dismissal and spends only its remaining
14 seconds of visible reading time. It resumes without restarting its timer.
Cleared summaries cannot return; new summaries get a fresh budget. See
[decision 0273](../decisions/0273-hud-message-priority.md).

## Rendered review

Matched captures use the actual React HUD over a fixed game frame with
controlled sample state, including intentionally crowded combinations. They
check presentation and component behavior rather than online authentication
or persistence. No new runtime art or effects are required. Documentation
images use quality-92 WebP.

| View                          | Before                                                                                   | After                                                                                  |
| ----------------------------- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Eight nearby players          | [Before](../previews/field-journal-hud-priority/before-healthy-party-wide.webp)          | [After](../previews/field-journal-hud-priority/after-healthy-party-wide.webp)          |
| Rescue and cold at 900 × 600  | [Before](../previews/field-journal-hud-priority/before-rescue-warmth-narrow.webp)        | [After](../previews/field-journal-hud-priority/after-rescue-warmth-narrow.webp)        |
| Boss, storm and party         | [Before](../previews/field-journal-hud-priority/before-combat-priority-wide.webp)        | [After](../previews/field-journal-hud-priority/after-combat-priority-wide.webp)        |
| Expanded details at 900 × 600 | [Before](../previews/field-journal-hud-priority/before-diagnostics-expanded-narrow.webp) | [After](../previews/field-journal-hud-priority/after-diagnostics-expanded-narrow.webp) |

Additional views: [quiet recap](../previews/field-journal-hud-priority/after-quiet-recap-narrow.webp),
[resumed recap](../previews/field-journal-hud-priority/after-receipt-restored-narrow.webp), and
[expanded details with rescue, cold and combat](../previews/field-journal-hud-priority/after-expanded-combat-warmth-narrow.webp).

## Verification

Controlled HUD checks passed at 1366 × 768 and 900 × 600: exact diagnostic
labels/values, native party scrolling, last-player reachability, and clearance
between connection, self-rescue, party, vitals and the pinned goal. The expanded
rescue/cold/boss/storm/ward combination also clears combat warnings. In that
maximum-pressure narrow layout the party viewport is small; all content remains
scrollable and collapsing diagnostics restores space. Self-rescue and vitals
remain visible.

Fake-clock checks on the actual HUD passed for initial deferral, repeated pauses,
14 seconds of visible time, expiry, dismissal, replacement summary IDs and
clearing while deferred. Ten priority gates and the open-settings → loading →
ready sequence also passed. The two unit test files passed all five tests.
Client and browser-test TypeScript, scoped lint/formatting, diff checks and the
client build passed. Astra approved the final code and rendered results.

The built-game regressions passed for repeated home transitions, indoor recap
pause/resume and dismissal, clearing a deferred summary when leaving, native
party/diagnostic scrolling without character movement, and pinned-goal
clearance at both tested window sizes. These used a local simulation with
controlled session responses. The existing shared-meal browser test also passed,
including the two-serving cost and benefits for both players.
