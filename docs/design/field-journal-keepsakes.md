# Field journal keepsakes

The Trophies page now uses the journal's paper wells, warm ink, fir actions and
copper focus. Displayed keepsakes have a quiet fir border and tint; locked and
disabled states keep readable text on pale paper. Existing painted building art
remains beside each story, with small item icons beside the material counts.

All eight stories, their order, prerequisites, hotkey numbers, display counts,
ownership rules and placement callbacks retain their behavior. Keepsake costs
and eyebrows use their own classes so this pass is independent of the Home
journal work in PR #356. Material icons also have their own size rule rather
than inheriting the larger story artwork's float and dimensions.

## Rendered review

Matched captures use the actual React HUD over a fixed game frame with controlled
sample state. The indoor restriction view renders the real collection directly,
because outdoor placement categories are not available inside the game's normal
crafting menu. These are presentation and interaction checks, not online
authentication or persistence checks. No new runtime artwork or effects are
required. Documentation images use quality-92 WebP.

| View                        | Before                                                                       | After                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Ready stories               | [Before](../previews/field-journal-keepsakes/before-ready-top.webp)          | [After](../previews/field-journal-keepsakes/after-ready-top.webp)          |
| Locked recipes              | [Before](../previews/field-journal-keepsakes/before-locked-top.webp)         | [After](../previews/field-journal-keepsakes/after-locked-top.webp)         |
| Displayed keepsakes         | [Before](../previews/field-journal-keepsakes/before-displayed-top.webp)      | [After](../previews/field-journal-keepsakes/after-displayed-top.webp)      |
| Keyboard focus at 900 × 600 | [Before](../previews/field-journal-keepsakes/before-ready-focus-narrow.webp) | [After](../previews/field-journal-keepsakes/after-ready-focus-narrow.webp) |

Additional states: [missing materials](../previews/field-journal-keepsakes/after-missing-materials-narrow.webp),
[first home needed](../previews/field-journal-keepsakes/after-no-home-action-narrow.webp),
[indoor restriction](../previews/field-journal-keepsakes/after-inside-restriction.webp),
[last story action](../previews/field-journal-keepsakes/after-last-story-narrow.webp),
[footer](../previews/field-journal-keepsakes/after-footer-narrow.webp), and
[placed once](../previews/field-journal-keepsakes/after-placed-once.webp).

Controlled browser checks confirmed the same story order, status copy and
placement gates across all six sample states. Enter and Space sent the expected
placement actions; a confirmed placement updated the count, removed its cost row
and disabled repeating it. Tab/Shift+Tab navigation, fixed headers, last-card
reachability and horizontal overflow checks passed. Material icons remained
16px without inheriting the larger artwork's float. Explicit indoor and no-home
checks confirmed all eight actions stay disabled with the original wording.
Astra approved the final code, screenshots and interaction evidence.

All three existing keepsake unit tests and both browser regressions passed. The
browser cases cover gallery placement and recipe locks, Home-to-Trophies
navigation, and recognition of a placed owned trophy and its story in the world.
They use the built client with a local simulation and controlled session
responses. Client and browser-test TypeScript, scoped lint/formatting, diff
checks and the client build passed.

The branch includes the same CI follow-up carried by PRs #355 and #356, allowing
the polish changes to be reviewed and checked independently.
