# Field journal HUD

The director approved the Field Journal concept (Option A): warm parchment,
thin fir-green binding and restrained copper selection marks. This first pass
applies that direction to the hotbar, pack button and health/hunger framing.

The six item wells are softly rectangular. The equipped item has a fir-green
inset and copper corners; usable items retain a lighter surface. Cream shortcut
tabs and dark quantity badges separate the two kinds of numbers. The pack keeps
its segmented capacity ring and a distinct keyboard-focus outline.

Health and hunger share one compact parchment card. Their established order,
icons, warning colors and damage feedback remain. Warmth stays separate above
the card. At narrower desktop widths the vitals move above the hotbar to leave
both visible. No new fonts, images, item icons or gameplay rules are introduced.

The inventory and journal contents, minimap and diagnostics panel are outside
this pass. Later menu work should reuse the approved material and state
hierarchy rather than adding more decorative motifs.

## Review

The opt-in `e2e/field-journal-hud.spec.ts` uses a local simulation fixture and
the actual HTML HUD. Each background is a real rendered game frame held still
behind that HUD while its controls are exercised. These are controlled visual
and interaction checks, not an online playthrough or a performance benchmark.

Review daylight and night, equipped/usable/empty slots, the pack capacity ring,
pack/journal opening and dragging, and low-health/hunger feedback with reduced
motion. Desktop layout checks cover 1366×768, 1920×1080 and 900×600. Preserve
keyboard shortcuts and meaningful warning states while refining the framing.

| View         | Before                                                       | After                                                      |
| ------------ | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Daylight HUD | [Before](../previews/field-journal-hud/before-day-hud.png)   | [After](../previews/field-journal-hud/after-day-hud.png)   |
| Night HUD    | [Before](../previews/field-journal-hud/before-night-hud.png) | [After](../previews/field-journal-hud/after-night-hud.png) |
| Open pack    | [Before](../previews/field-journal-hud/before-day-pack.png)  | [After](../previews/field-journal-hud/after-day-pack.png)  |
| Open journal | [Before](../previews/field-journal-hud/before-day-craft.png) | [After](../previews/field-journal-hud/after-day-craft.png) |

The [low-status, reduced-motion view](../previews/field-journal-hud/after-warning.png)
and [900×600 layout](../previews/field-journal-hud/after-narrow.png) retain readable
warnings and separate the vitals from the hotbar. Astra approved the final
captured treatment. The existing unpinned-weapon behavior is unchanged; the
capture pins the axe through the pack-to-hotbar drag before equipping it.

Captures use WebGL2 with a fixed seed and player pose. Particle phases can
differ. The final HUD checks reused each build's previously rendered day/night
backgrounds; the interface, controls and selected-state assertions remained
live. This does not certify native WebGPU rendering or overall performance.

To repeat the opt-in review with the normal local Playwright configuration:

```sh
HUD_REVIEW_SHOTS=/tmp/field-journal-hud pnpm exec playwright test e2e/field-journal-hud.spec.ts
```

The default checks require the current layout to keep the hotbar and vitals
separate. `HUD_CAPTURE_BASELINE=1` is only for documenting the pre-change layout;
it records the old overlap rather than accepting it as current behavior.
