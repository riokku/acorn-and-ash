# 0084 — Personal expeditions at home

Players can choose one optional outing from three housing-tier choices at their own home board. Choices are seeded by world, character and completed-outing cycle; they refresh on reward collection and never expire. The journal can be read anywhere, while acceptance and reward collection require the owner's home interior or proximity to its outdoor cedar board.

The server counts actual gathering, felled trees, caught fish, contributed skeleton victories and landmark visits. Inventory transfers and dropped-item pickups do not advance gathering objectives. Progress, completed outings and learned cosmetic recipes belong to the character in its current world and are saved privately alongside the backpack. Missing or malformed legacy state starts empty.

Claiming first checks all material rewards against a copied backpack. A full backpack preserves the entire reward and completed outing. A successful claim saves the inventory and expedition in one SQLite transaction, then advances the choice cycle; repeat claims cannot pay again. Three completed outings teach a stat-free trail pennant recipe, with authoritative indoor and outdoor placement checks. New packet and buildable identifiers append to existing orders.

Initial objective counts are a starting balance. The target remains 15–25 minutes per outing; actual player timings must inform the later balancing pass. No timer, daily reset or offline decay is introduced.
