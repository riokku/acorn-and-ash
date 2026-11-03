# 0281 — The woodshed: buildable log storage

## Context

Chris asked for a woodshed using Polyfork's free Open Woodshed (decision 0272).
On 2 November 2026 he chose "buildable log storage": you build it near home, it
stores extra logs, and it shows them filling up as you add them, like the
cabin's log shelf. The cabin holds 20 logs and the large cabin 50, both on a
shelf beside the house.

## Decision

- `woodshed` is a new buildable on the Craft menu's Home page. It costs 10 logs
  and 8 sticks, and each player can have one. Its wire id is appended to
  `BUILDABLE_KIND_ORDER` and `DECORATION_REQUEST_KINDS`, so older ids don't move.
- It holds 40 logs. It reuses the cabin shelf's storage rules in
  `packages/shared/src/sim/fire-fuel.ts`: only its owner can store or take logs,
  from within 2 m of the shed's middle, and the server checks every request.
  The stored count is saved with the world and sent in the same fire-fuel
  message as the cabin shelf's. A woodshed never burns: fire requests on it are
  refused.
- It is drawn as the Polyfork shed, shrunk to 3.4 × 1.7 m, with the logs stacked
  inside, ten to a row, open side facing forward. Until the model downloads, a
  plain wooden lean-to stands in for it.
- For collision it is one solid block. You stand at its open front to use it;
  you can't climb its stack the way you can climb the cabin's shelf.
- It can't be packed up while logs are inside, the same rule as the cabin.

## Consequences

Players get somewhere to put logs beyond the cabin's shelf without a new kind of
storage to learn. Logs in the woodshed are not counted as home supplies for
building or upgrades; they have to be taken out first, like the cabin shelf's.
If that turns out awkward, both stores could count later.

Summer wildfires don't burn it, the same as the workbench and pantry; only
homes, fences, benches and tables burn. Whether a shed full of logs should
burn is left for Chris to decide.
