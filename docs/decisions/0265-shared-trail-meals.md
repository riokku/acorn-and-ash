# Share a trail meal

Give nearby adventurers a quiet preparation ritual using existing food, input and
meal rules. Hold at least two prepared servings outdoors. The nearby-adventurer
panel identifies one eligible companion and says that E uses two servings, one
for each player. The server chooses the nearest eligible living companion within
2.4 m horizontally and 1.5 m vertically. Both must be idle, out of boats, not
fishing, and without an active meal benefit.

Validate both players before consuming two host servings. Apply ordinary hunger
and meal benefits to both; do not add a separate group buff or duplicate loot.
Existing benefits are never overwritten by sharing. Normal meals remain useful
at full hunger, and a guest does not need an empty inventory slot. A held E
cannot repeat the transaction. Rescue retains priority for downed companions.

Use a spare bit in the existing ten-byte ally record to advertise the selected
eligible guest; packet size and message IDs stay unchanged. The server still
rechecks eligibility at the moment of interaction. There is no new timer,
permanent group system, currency or model.
