# 0190 — Basic creature clothing

Creature loot needs a simple equipment set before a later art pass. Chris explicitly approved non-Blender assets for this pass, with more polished replacements later.

Add a wool cap (+1 protection, +15 warmth), linen shirt (+2 protection, +5 warmth) and work trousers (+2 protection, +10 warmth). They use the existing head, upper-body and lower-body equipment slots, survive knockout like other gear, and expose their names, descriptions, rarity and bonuses through the item admin catalog. Append their item indices so existing inventories and saves remain valid. The full set provides 5% protection and 30 warmth; it does not replace a winter jacket.

Roll once after an authoritative creature defeat: 15% for ordinary wildlife, 30% for hostile raccoons and skeletons, and 50% for guardians and sentinels. Each of the three pieces is equally likely. Friendly curious raccoons never drop clothing. Rewards appear as normal public ground loot, so a full pack does not silently lose the drop. Existing food, bones, blueprint and trophy rewards continue independently.

The first-pass cap is a small faceted dome with a folded cuff, fitted to each body's head bounds and weighted to its head bone. Shirts and trousers reuse the existing body-fitted, skinned clothing layers in muted linen and earth colors. They follow the same animation rig on every body. A basic-clothing gallery supports before/after and rear inspection. These code-built models can later be replaced with Blender exports without changing item ids, stats or saves.
