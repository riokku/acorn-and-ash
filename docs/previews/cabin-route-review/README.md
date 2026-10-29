# Cabin and forest review

These are real WebGL2 canvas renders of the game with a controlled local
`WorldSimulation` fixture. They are not an online playthrough or a performance
benchmark. The baseline is merged PR #340 (`dd89812`).

The home images use a teepee-to-cabin upgrade at (-2, -4.2) that passes the
simulation's building checks. Its fire is set lit for the review. Departure and
return are fixed outdoor poses, not a recorded door transition. Daylight and
night retain natural seeded weather; `storm` explicitly forces storm weather.
Rain can therefore also appear in the daylight images.

The combat images use a normal warrior AI placed near the measured Cedar trail
endpoint. The fixture advances snapshot timestamps with simulation ticks. It
captures the displayed action and warning in the same animation frame as the
canvas, rather than assuming the server's current action is already on screen.
The accompanying JSON records phase, age, warning visibility and player health.
Combat captures are phase comparisons; AI positions and particle phases can
differ between runs. They do not establish real-time combat timing or sound.

Reviewed baseline phases: [wind-up](nameplate-before.png),
[swing](combat-swing-before.png), [recovery](combat-recovery-before.png), and
[same-frame state](combat-before.json). The [candidate wind-up](nameplate-after.png)
has its own [state record](nameplate-after.json). Its full combat run was
interrupted; candidate swing/recovery are not certified here. The candidate
home and remote-companion run completed with no page errors.

The candidate omits the local player's own floating name. Remote player and
enemy labels retain their existing behavior. Camera collision, foliage,
lighting, weather and combat rules have not been changed.

## Repeat the review

With dependencies and Playwright Chromium installed, the repository's normal
Playwright configuration builds and serves the local game:

```sh
CABIN_FOREST_SHOTS=/tmp/cabin-home CABIN_REVIEW=home pnpm exec playwright test e2e/cabin-forest-direction.spec.ts
CABIN_FOREST_SHOTS=/tmp/cabin-combat CABIN_REVIEW=combat CABIN_CONDITION=day pnpm exec playwright test e2e/cabin-forest-direction.spec.ts
```

The test is opt-in and otherwise skips. `CABIN_REVIEW` also supports `trail`,
`route` and `stress`; `CABIN_CONDITION` accepts `day`, `night` or
`storm`. Home mode adds a separate remote-companion control after its matched
home views. See the fixture for each mode's boundaries. Use separate output
directories for baseline and candidate, and verify the served bundle before
comparing results. The default renderer is WebGL2; automatic backend selection
does not certify native WebGPU coverage.

The audit in [visual-audit.md](../../design/visual-audit.md) separates accepted
observations, rejected experiments and outstanding review work.
