# Log-fueled fires and cabin firewood

Chris requested ten minutes of flame per log, cooking and warmth tied to that
flame, and nearby controls. Each indoor cooking fire and outdoor campfire holds
five logs (50 real minutes). New fires start empty. Adding a log lights the fire;
putting it out preserves its unused fuel. A relight spends no extra log. A whole
log must fit before inventory is charged, so refueling never discards part of it.

Fires use real-time deadlines, retaining the existing campfire behavior while a
world sleeps. No idle-world timers are introduced. Empty or expired fires provide
neither cooking nor warmth. A fueled indoor fire warms its home; an unheated home
still shelters against the extra blizzard exposure, but does not restore warmth.
Tents have no cooking fire. The torch remains a permanent tool.

Cabins have a separate outdoor wood pile: 20 logs for a cabin, 50 for a large
cabin. The owner can store inventory logs or withdraw what fits in their pack.
Stored wood never feeds a fire automatically. Upgrades preserve its count and
increase capacity; a destroyed cabin spills stored logs alongside chest contents.
The existing log artwork is reused, with one visible piece per stored log. The
pile follows the ground and has a shared solid footprint when occupied.

The server validates reach, height, space, ownership, inventory and capacity.
Fuel/storage changes and the acting player's inventory save in one SQLite
transaction. Existing `lit_until_ms` deadlines are retained; new `fuel_ms` and
`stored_logs` columns default to zero. Old unlit fires/hearths start empty and old
lit campfires burn out at their saved deadline. New binary messages append to the
message tables without changing existing built-prop packets. Clients interpolate
remaining fuel between authoritative updates and show nearby meters and buttons.

This replaces the free campfire lighting in decision 0033 and unconditional indoor
heat in decision 0180. Existing recipes and controls remain: E cooks held raw food
at a lit fire; otherwise E lights or puts out the nearby fire, spending one log
if it was empty. Both meters also offer explicit buttons.
