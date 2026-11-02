# Field journal homestead

The Home tab's shelter journey, useful projects, remembered stories and gathering
nook now share the surrounding journal's paper, fir actions and copper focus.
Thin inset wells replace the dark nested panels. Existing painted building art
stays beside headings, and small material icons accompany the unchanged names
and quantities. Completed projects use a calm fir check; missing supplies,
blueprints and disabled actions remain readable on paper.

Shelter tiers, project progress, carried and stored supply totals, blueprint
requirements, build restrictions and callbacks retain their existing behavior.
The journal header and category tabs stay fixed while the existing list scrolls.
No new runtime artwork or effects are required, and reduced-motion handling is
preserved.

## Rendered review

These matched captures use the actual React HUD and components over a fixed
game frame with controlled sample state. The indoors restriction view renders
the real plan directly because the game's indoor crafting categories do not
offer the outdoor Home tab. These captures do not exercise online authentication
or persistence. Documentation images use quality-92 WebP.

| View                  | Before                                                                          | After                                                                         |
| --------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Shelter materials     | [Before](../previews/field-journal-homestead/before-shelter-partial.webp)       | [After](../previews/field-journal-homestead/after-shelter-partial.webp)       |
| Projects at 900 × 600 | [Before](../previews/field-journal-homestead/before-projects-ready-narrow.webp) | [After](../previews/field-journal-homestead/after-projects-ready-narrow.webp) |
| Stories brought home  | [Before](../previews/field-journal-homestead/before-stories-remembered.webp)    | [After](../previews/field-journal-homestead/after-stories-remembered.webp)    |
| Gathering nook        | [Before](../previews/field-journal-homestead/before-nook-nook.webp)             | [After](../previews/field-journal-homestead/after-nook-nook.webp)             |

Additional states: [first home](../previews/field-journal-homestead/after-home-start.webp),
[blueprint needed](../previews/field-journal-homestead/after-shelter-locked-narrow.webp),
[keyboard upgrade focus](../previews/field-journal-homestead/after-shelter-ready-focus.webp),
[completed projects](../previews/field-journal-homestead/after-projects-complete.webp),
[indoor restrictions](../previews/field-journal-homestead/after-nook-inside.webp), and
[footer](../previews/field-journal-homestead/after-home-footer-narrow.webp) and
[focused ordinary build action](../previews/field-journal-homestead/after-home-build-row-narrow.webp).

Controlled checks passed for upgrade, project and nook callbacks; blueprint,
supplies and indoor restrictions; keepsake navigation; keyboard expansion and
selection; fixed headers and horizontal overflow. At 900 × 600, project buttons
and the ordinary build row's name, materials and status remain visible and
reachable. Small metadata and story text were darkened after checking contrast
against the rendered paper. Astra approved the final code and captures.

All nine existing homestead, shelter-upgrade and home-story unit tests passed.
Client and browser-test TypeScript, scoped lint/formatting, diff checks and the
client build passed.

All four selected existing browser regressions passed against the built client:
completing the three projects, using carried and stored supplies for the real
shelter-upgrade preview, remembering a rumor and unlocking the trail pennant,
and choosing furniture from the gathering nook. They use a local simulation and
controlled session responses.

This branch also carries the same CI follow-up as [PR #355](https://github.com/riokku/acorn-and-ash/pull/355):
genuine grass frames before and after thinning with fast logic checks between,
and room for the low-hunger pulse beside health. That shared fix allows both
polish PRs to be checked independently.
