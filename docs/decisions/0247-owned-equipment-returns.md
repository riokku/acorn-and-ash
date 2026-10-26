# Owned equipment returns and acquisition limits

A worn shovel left the backpack, so world pickups could grant another shovel. Later, swapping to an axe or sword tried to return the worn shovel through `addItem`, which enforces the one-shovel acquisition limit. This falsely reported a full pack despite free slots.

Returning worn equipment now checks physical stack/slot space without applying the acquisition cap a second time. Failed swaps restore the original pack exactly, including legacy duplicate counts. Genuine full packs still refuse unequipping. Gear already owned and returned to the pack survives inventory encoding, client display and server save/reload; acquisition limits are still applied when collecting new items. Non-equipment restore limits retain their previous behavior.

World pickups, dropped loot and reward collection count worn equipment alongside backpack items when applying an item's existing maximum. A refusal leaves the item on the ground and reports the ownership limit. Client hover feedback uses the same ownership count. Private stored items and crafting rules are unchanged.

Equipment rejection messages appear in normal play as well as the character screen, so toolbar and bag attempts have visible feedback. Starting another equipment request clears the previous gear rejection without changing unrelated notices. Combat, busy-state and item-slot checks are unchanged. There are no item-ID, protocol, art or persistence-schema changes.
