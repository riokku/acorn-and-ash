# Field journal menus and item art

This pass carries the approved HUD's paper, fir-green binding and copper
accents into the pack, crafting journal, equipment screen, tabs, context menus
and tooltips. Shared surface tokens keep those panels related to the hotbar.
Inset wells, quantity badges and active tabs use the same visual hierarchy.

The first painted icon family covers 16 everyday objects: axe, rod, shovel,
torch, berries, mushroom, raw meat, roasted meat, backpack, log, sticks, rope,
reeds, bone, stone and forest stew. Outlined silhouettes and broad material
colors keep them readable on both paper and selected green slots. Other items
and buildable icons retain their existing distinct art until their families
are reviewed. See [decision 0269](../decisions/0269-painted-journal-icons.md).

Open `/?gallery=icons` to inspect the production renderer at 13, 24, 30 and
40 pixels on paper and fir backgrounds. Thin objects at 13 pixels accompany
ingredient text; the larger icons identify objects by silhouette and material.
The [complete catalog pass](painted-icon-catalog.md) extends this treatment to
all current items and buildables, plus matching HUD symbols.

Each illustration is centered from its measured visible bounds without
stretching, and its crop excludes neighboring atlas art.

The panel review uses the actual HTML UI over a frozen game frame from the
same world build. It covers a populated and mostly empty pack, available and
blocked recipes, category and journal tabs, character alongside pack, item
dragging, tooltips, context actions and narrow desktop layouts. Captures wait
for menu transitions and preview readiness. These are controlled UI checks,
not an online playthrough or performance benchmark.

To repeat the opt-in panel capture with the normal Playwright configuration:

```sh
MENU_REVIEW_SHOTS=/tmp/field-journal-menus pnpm exec playwright test e2e/field-journal-panels.spec.ts
```

The atlas is a single cached transparent WebP, generated with OpenAI image
generation and recorded in `assets/LICENSES.csv`. No additional runtime image
generation, models, fonts or graphics effects are required.

## Reviewed evidence

Baseline: merged HUD pass `b374b7e`. These captures use the same frozen game
background while the real menus, item state and character preview run live.
The test waits for the painted minimap, panel transitions and preview readiness.
Both baseline and candidate runs completed without page errors. Astra approved
the panels and the normalized icon family at actual display sizes.

| View               | Before                                                         | After                                                        |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Populated pack     | [Before](../previews/field-journal-menus/before-pack.png)      | [After](../previews/field-journal-menus/after-pack.png)      |
| Crafting           | [Before](../previews/field-journal-menus/before-craft.png)     | [After](../previews/field-journal-menus/after-craft.png)     |
| Character and pack | [Before](../previews/field-journal-menus/before-character.png) | [After](../previews/field-journal-menus/after-character.png) |

Additional controls: [empty pack](../previews/field-journal-menus/after-empty-pack.png),
[context actions](../previews/field-journal-menus/after-context.png),
[discoveries](../previews/field-journal-menus/after-discoveries.png),
[narrow pack](../previews/field-journal-menus/after-narrow-pack.png),
[narrow crafting](../previews/field-journal-menus/after-narrow-craft.png), and
[icon size/background board](../previews/field-journal-menus/icons-board.png).

The capture helper suppresses only the main scene's draw calls for this review,
allowing the equipment preview to draw for real. Other smoke tests keep their
existing drawing behavior. These captures use Chromium/WebGL2 and do not
certify native WebGPU rendering or overall performance.
