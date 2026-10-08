# 0113 · Blizzards and wildfires

## Context

Winter already freezes the lake and dresses the forest in snow. Weather now needs occasional three-day blizzards and dangerous summer lightning, shared by everyone in the world. The director chose destructible trees and buildings, player damage, spilled chest contents, and fires that burn out without an extinguish interaction.

## Decision

A seeded forecast gives half of winters one blizzard, starting on days 1–4 and lasting exactly three game days. The existing winter ice remains. Blizzards bring denser wind-driven snow, fuller ground coverage, shorter visibility, and 22% slower walking/sprinting outdoors. Both prediction and authoritative movement use the same multiplier. A bounded footprint pool shows local and remote footsteps and fills impressions faster during blizzards.

Summer storms attempt a lightning strike every 18 seconds near an outdoor player. A strike has a 45% ignition chance. Burning trees and wooden structures spread once after 12 seconds to targets within five metres (including building footprint radius), with 65% probability. A fire front has at most three spread generations and 32 simultaneous fires. Trees burn for 55 seconds and structures for 90; nearby players take eight damage per second. Trees use existing stump/regrowth persistence; destroyed homes evacuate occupants and drop their chest stacks before removal.

The server owns strikes, fire fronts, damage, destruction and saved fire state. Fires advance with active world time, pausing in empty worlds. Bounded binary snapshots include the active fires and last lightning strike, including on joining. Rendering reuses the authored flame model with soft flame wisps, layered smoke, embers, and the existing pooled fire lighting. Only the nearest eight fires render; reduced motion disables lightning flashes, embers, and particle movement.

Local/preview environments that already allow test seasons also accept `?weather=blizzard` or `?weather=storm` when the first player joins an empty world. The server announces the override to all viewers; production ignores it. Test overrides are not saved.

## Consequences

Clearing space between trees and homes can limit fire spread. Existing winter ice, knockout, tree regrowth, chest loot and removal rules stay authoritative. No new art assets or network commands for players to ignite fires are added. Storm probabilities and damage are initial tuning values; spread caps protect both gameplay and server/browser budgets.
