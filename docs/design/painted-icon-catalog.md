# Painted icon catalog

Every current item and buildable now has a painted illustration in the approved
field-journal style. The health, hunger, settings, season and recovery compass
symbols use the same copper, wood, cloth and paper treatment. Keyboard hints
and accessible control names remain readable text.

Open `/?gallery=icons` for the complete production-renderer board at 13, 24,
30 and 40 pixels on parchment and fir backgrounds. Thin objects at 13 pixels
accompany ingredient names; larger icons identify items through shape and
broad material colors. Gear variants, trophies, fish species and blueprint
sizes retain their own artwork.

Six shared transparent WebP sheets total about 2 MB, including the original
everyday-item sheet. Five new sheets use quality-90 RGB encoding and lossless
alpha. Their dimensions and alpha masks match the generated originals.
Measured per-sprite bounds preserve proportions and normalize apparent size;
unique SVG clips prevent neighboring artwork from entering the viewport.
See [decision 0271](../decisions/0271-complete-painted-icon-catalog.md).

The opt-in captures use the actual gallery and HUD over a controlled frozen
game frame. They cover a pinned equipped axe, pack/crafting, day and night,
low health/hunger, reduced motion, recovery-compass bearings, keyboard focus,
and 900 × 600 through 1920 × 1080 desktop layouts. They do not certify online
authentication, continuous gameplay, native WebGPU or frame rate.

| View    | Before                                                    | After                                                   |
| ------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Day HUD | [Before](../previews/painted-icon-catalog/before-hud.png) | [After](../previews/painted-icon-catalog/after-hud.png) |

Review the [complete size and background board](../previews/painted-icon-catalog/icons-board.png)
and [night warning state](../previews/painted-icon-catalog/after-warning.png).
The before capture uses merged menu pass `caf68e9`; final captures use the
compressed atlases rebased onto `9a7079d`. A shared frozen world background
keeps attention on the live HUD. The compass checks use three distinct cache
IDs and assert changes in bearing and a stable rotation center.

```sh
ICON_REVIEW_SHOTS=/tmp/icon-catalog pnpm exec playwright test e2e/icon-catalog.spec.ts
CATALOG_HUD_SHOTS=/tmp/icon-hud pnpm exec playwright test e2e/icon-hud-review.spec.ts
```
