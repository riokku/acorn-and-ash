# 0213 — Recover the weapon a skeleton carries

Skeleton weapons existed as scenery attached to the enemy, while only the iron
sword and hunting knife were wearable inventory weapons. To make the requested
2–5% drop match what players see, append five inventory IDs: rusty sword, raider
dagger, raider greatsword, bone staff and watch greatsword. Sentinels and captains
already share the last model. No existing wire IDs move.

A shared table maps every skeleton kind to its item and rate: minions/rogues 5%,
warriors/mages 3%, sentinels/captains 2%. An independent seeded roll runs at the
existing once-per-defeat bonus-loot callback, alongside bags and clothing. Full
inventories leave the weapon on the ground. Existing pickup, save, equipment and
admin-catalog paths handle these items.

Player and ground models reuse the exact existing skeleton weapon geometry and
materials, with no new external art. The items fit the main hand and grant modest
Power bonuses (25, 25, 45, 35 and 55 respectively), retaining the normal attack
animations. The staff is a melee weapon and grants no spellcasting. Like existing
weapons, these are kept through knockout and limited to one carried copy per item.
