# 0065 — Falling trees, loose logs and fishing-only clicks

## Context

Trees vanished on the final blow and put their wood straight in the cutter's
pack. Chris chose a visual fall away from the final cutter, followed by
individual logs gathered with E. Falls must cause no damage or blocking.
A fishing click also sometimes became a light attack when a catch ended.

## Decision

The server records the fall direction and real start time with the tree.
Clients tip the existing tree about its foot for 1.4 seconds, then remove it
at 1.8 seconds. A joining observer uses the same timeline. The stump and
regrowth rules stay in place.

Each tree leaves its existing wood yield as individual log pickups along the
fallen trunk, nudged onto clear ground where necessary. They are saved on the
final blow with a future availability timestamp, and become visible and
collectible when the fall ends. They use the existing shared pickup rules,
bag capacity and ten-minute expiry. No extra timers or physics bodies run.

Fishing uses its own input bit. A catch attempt remains a fishing command
even if the server has already ended the line, and cannot fall back to a
weapon attack. The browser consumes both quick fishing taps and releases.

## Consequences

Players walk to gather wood, and another player can gather it too. Full packs
leave logs on the ground. Disconnecting during a fall neither loses nor
duplicates its wood. Old stored stumps need no replay or replacement loot.
Tree messages include direction and time; their decoder still accepts the
older stump-only format. Clients and the game server should deploy together
to support the new fishing input and falling visuals.
