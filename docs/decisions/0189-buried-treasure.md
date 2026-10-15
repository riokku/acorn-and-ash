# 0189 — Public buried treasure

Players can discover shovel-only buried loot around the map. Knockout belongings already have ownership and private recovery markers, so treasure must not share that ownership or persistence path.

Seed up to 24 treasure mounds once per world, with four placement searches nearer the clearing and the rest across the wilderness. Reject water, steep ground, scenery, buildings, encounter sites and crowded interactions. Use the existing lost-supplies mound, grounded and aligned to its local slope. A separate seeded weighted table rolls three to five bundles of supplies, food and occasional equipment. Contents remain server-only. All players see the same public mounds; these have no map or recovery compass markers.

An equipped shovel and normal ground-item reach are required. E or a shovel impact digs the nearby mound without carving terrain. Any player may take its loot. Inventory overflow stays in the mound; a full pack consumes nothing. The server writes remaining treasure and the digger's inventory in one SQLite transaction. Empty arrays mean the world's treasure has been collected; reconnecting or hibernating never rerolls it. There are no respawn timers in this first version.

Treasure uses its own bounded position packet (0x4a, reserving 0x49 for fire fuel), separate ids and a versioned metadata save. This leaves death-cache packets, ownership and recovery behavior unchanged. Private dig feedback uses two new values in the existing cache-notice packet. Future replenishment can be added as an explicit rule without tying rewards to reconnects.
