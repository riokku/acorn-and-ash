# 0131 · Reliable browser regression checks

## Context

The browser job grew to over 160 cases and regularly ran for 90–110 minutes before failing. Many newer gameplay specs still painted the forest in software, despite decision 0100. Slow frames made brief key presses and time-limited interactions unreliable. Some expectations also predated shallow lake wading and remembered journal tabs. The keyboard shortcut guard introduced a real regression: Control's own keydown carries `ctrlKey`, so the dodge key was ignored.

## Decision

- Gameplay specs import `test` from `e2e/fixtures.ts`. The common context fixture skips WebGL draw calls, including in extra pages sharing the context, while retaining input, simulation, networking, UI, shader compilation and scene updates.
- Rendering checks use `@real-drawing`. Asset galleries always draw, and `ACORN_E2E_DRAW=1` or `SHOT_DIR` preserves real drawing for requested screenshots. The rendering and WebGL fallback checks remain in CI. Weather transitions run without continuous forest rasterization, then capture actual canvas pixels in a restored render frame, with shader-error checks.
- Test the current shallow/deep lake boundary and explicitly select Crafting after reopening a journal that remembers Discoveries or Expeditions. Cast through real browser input in the rare-fishing fixture, wait for camera projection to catch up with its heading, and consume older queued inputs before selecting the rare hook tick. Allow Left Control itself through the shortcut guard, with a unit regression check; Ctrl+letter shortcuts remain with the browser.
- Balance individual cases across four independent CI shards, each with one browser worker. All cases still run. Each shard has a 35-minute limit and its own failure artifacts; one failure does not cancel the others. The existing `Browser smoke tests` check succeeds only when every shard succeeds.
- Multiplayer uses an isolated world, connects both tabs before waiting for two players, and identifies the exact remote avatar after both worlds load. Woodland waits for an acknowledged E release between discoveries. Weather stays on the same summer day and explicitly delivers its clock change. The fox test uses a private real simulation, a controlled starting position, real fleeing and mouse input, and an authoritative meat reward; a fox leaving the interest radius no longer counts as a catch. The real-server rabbit hunt still checks the woodland journey.

## Consequences

Gameplay correctness no longer depends on the CPU painting thousands of leaves. Gameplay screenshots need the drawing override to show the world. Rendering coverage stays explicit, and new specs should use the common fixture and opt in when they assert actual drawing. Sharding reduces waiting time while using more simultaneous CI machines.
