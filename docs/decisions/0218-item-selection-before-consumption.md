# Select food before eating and make weapon clicks actionable

Ordinary clicks on gear weapons were silently rejected by the pack-only item
selection gate. They now use the existing gear request to put/draw a weapon in
the main hand. Server checks and equipment stats continue through `wearGear`;
weapons are not reclassified as ordinary pack tools. Explicit toolbar pins can
resolve a weapon from the worn main hand as well as the pack. Automatic toolbar
assignment continues to include only tools and food.

Food selection now equips without consuming. A subsequent use of that same held
food eats it when hungry, or applies a prepared meal benefit at full hunger.
This applies consistently to pack clicks, toolbar clicks and toolbar keys.
Holding raw food and interacting with a lit cooking station still cooks it.
A deliberate second toolbar click can eat raw food even beside a fire. Tooltip
instructions explain the two uses. No item IDs or message formats change.
