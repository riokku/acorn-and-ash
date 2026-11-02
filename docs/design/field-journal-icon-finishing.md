# Field journal icon finishing

The fishing journal now uses the same painted perch, trout and golden carp
illustrations as the inventory. Their names, notes, catches, best lengths and
display-recipe progress retain their wording and order. The illustration area
stays compact so the page remains readable in short windows.

A painted ivory skull replaces the font-dependent raid symbol. It shares the
system-icon renderer and stays decorative beside the existing singular/plural
enemy count. Its red warning pill retains its appearance and behavior.

The character picker now shows the six actual playable bodies. Each image is
rendered from its current model with neutral materials, default skin and beard,
a fixed idle pose and common framing. The large live stage continues to show
chosen tint and skin; body names, availability, check marks, focus and entry
behavior retain their roles. The body buttons also expose their pressed state.

## Reproducing the body images

Start the client, then run `tools/render-body-icons.mjs` with `BODY_ICON_BASE_URL`
set to that dev-server address. `PLAYWRIGHT_CHROMIUM_PATH` optionally selects a
local Chromium executable. The opt-in `/?gallery=body-icons&body=knight` view
supports every canonical character ID. It uses one transparent 192 × 256 renderer
per page, then the script encodes 96 × 128 WebPs and records current source hashes
in [body-portrait-sources.json](body-portrait-sources.json). Regenerate after a
body model changes; the asset-integrity test flags stale sources. See
[decision 0274](../decisions/0274-static-character-picker-portraits.md).

The six thumbnails total 20.8 kB; the threat sprite is 15 kB. Neither adds a live
renderer to the picker. The new skull uses generated art, and derived body images
retain the credits and licenses of their source models.

## Rendered review

Matched captures use actual React components with controlled sample state. The
home stage draws the real models; the HUD backdrop is a fixed game capture.
These checks do not certify online authentication or persistence. Documentation
images are quality-92 WebP.

| View                      | Before                                                                | After                                                               |
| ------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Fishing records           | [Before](../previews/icon-finishing/before-fishing-partial-wide.webp) | [After](../previews/icon-finishing/after-fishing-partial-wide.webp) |
| Character picker          | [Before](../previews/icon-finishing/before-home-wide.webp)            | [After](../previews/icon-finishing/after-home-wide.webp)            |
| Threat badge at 900 × 600 | [Before](../previews/icon-finishing/before-raid-narrow.webp)          | [After](../previews/icon-finishing/after-raid-narrow.webp)          |

Additional views: [narrow records and unlock text](../previews/icon-finishing/after-fishing-complete-narrow-bottom.webp),
[Body 6 selected](../previews/icon-finishing/after-home-selected-six-narrow.webp),
[night threat](../previews/icon-finishing/after-raid-night-narrow.webp), and
[threat sizes on paper and fir](../previews/icon-finishing/after-threat-size-background-board.webp).

## Verification

Controlled checks passed for exact fish text in empty, partial and completed
collections, illustration bounds, six keyboard-selectable bodies, live-stage
identity and raid counts 1/12/999 at 1366 × 768 and 900 × 600. All six generated
portraits have clear alpha margins and full visible silhouettes. Astra approved
the code and rendered review. Skin/tint preservation, keyboard entry, night
contrast and the threat-size board also passed. All 13 targeted unit checks,
client and browser-test TypeScript, scoped lint/formatting, asset licensing,
diff checks and the client build passed.

All four browser cases passed against the built client with controlled session
responses: choosing bodies on the real entry screen, landing a rare fish with
real clicks and unlocking its collection display, reopening saved species pages
at wide and 600px widths, and the production icon gallery with seven shared
image sources and unique clipping IDs. These checks use a local simulation;
they do not certify online account persistence.
