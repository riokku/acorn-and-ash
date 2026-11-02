# 0279 — Browser-test shortcuts: quick regrowth and standing near a target

## Context

The browser tests spend much of their time waiting rather than checking. In
`e2e/play.spec.ts`, "a chopped tree grows back on its own" waited two to four
real minutes for the oak, 3 minutes of a 2¼-hour suite. A dozen other tests
whose subject is crafting, chopping, building or looting first walk to the
axe, a tree or a stick patch in short steps, up to 80 steps per walk. On a slow
runner each walk can take most of a minute. Chris approved both shortcuts on
2 November 2026. Production, staging and previews must not change, and the
server stays in charge of where players are.

## Decision

- A new server setting, `WORLD_ALLOW_TEST_SHORTCUTS`, is `"1"` only in the
  `e2e` Wrangler environment and the game server's own tests. It is never set
  for local play, previews, staging or production. Without it the server
  ignores both shortcuts.
- **Quick regrowth.** A test that opens its world with `?quickRegrow` gets
  trees that grow back in 4–8 seconds instead of 2–4 minutes. Like `?season=`
  (decision 0089), only the first player into an empty world can ask.
- **Standing near a target.** A new client message, `TestPlace` (fixed id
  `0x12`), asks the server to stand the player at a spot, facing a direction.
  The server moves only an outdoor player, and only where the setting is on.
  Tests opt in per page with `skipWalks(page)`. The walking helpers then ask
  to stand a step short of the target and finish with the usual short walk,
  so reach and prompts are still checked the real way.
  Stood beside one find, the next can be in reach too and come along with
  it, so for these tests the reach check also stops once the item is carried.
- Tests about moving never opt in: walking, sprinting, dodging, jumping, the
  wilderness, the pond and fishing, and two tabs seeing each other.

## Consequences

The regrowth test checks the same thing without the long wait, and the opted-in
tests skip most of their walking. Every other server sees an unknown request and
ignores it, the same as any malformed message. A test that should check walking
must not call `skipWalks`. The regrowth test no longer gathers the fallen logs,
because the chopping test already covers that. The recorded test times used to
split the browser shards (decision 0278) will read slow for these tests until
they are refreshed.
