# Housing facilities and expedition supplies

## Context

Housing should give each expedition a purpose: bring supplies home, learn the next skeleton blueprint, and unlock a useful facility. Private storage must stay private, and upgrades must retain the home and everything inside it.

## Decision

Tents offer rest and ten storage slots. Teepees add a cooking station; small cabins add a workbench for a refined axe and fishing rod; larger cabins add three garden boxes. Existing outdoor campfires remain usable. Cooking and workbenches welcome visitors; only owners can plant or harvest their gardens. Each box consumes one berry, mushroom or flower and yields three after ten minutes while the world is awake. Ready plants never expire, and a full pack leaves the harvest intact.

Upgrades consume the backpack first, then that owner's private home chest. The build journal explains this and counts both sources; ordinary construction and crafting still use the backpack. The server validates every placement, knowledge, occupancy and payment condition before spending. Home, backpack and chest are saved together. A private message reports only the recipient's own stored totals.

Starting costs: tent six sticks; teepee twelve logs and sixteen sticks; small cabin forty logs, twenty-four sticks and eight bones; larger cabin 120 logs, twenty-four sticks and twenty bones. These support the agreed several-session progression; the three-to-five-hour target still needs playtesting. The largest upgrade fits the combined backpack and chest while keeping room for two tools.

## Consequences

Garden time pauses when nobody is connected and persists across restarts. Visitors keep a world awake without gaining garden ownership. Item and message identifiers append to existing orders so old saved items retain their meaning. Improved tools speed gathering and fishing without increasing combat damage or narrowing the catch window. Future balance changes can adjust costs and growth independently of the facilities.
