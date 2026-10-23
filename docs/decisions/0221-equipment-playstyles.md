# Equipment that changes decisions

Existing specialties already reward trail preparation, warmth recovery and careful
hunting. Leather boots now shorten dodge cooldown by 15%, and an active iron
sword grants 20% additional damage when catching a hostile creature recovering
from an attack. These are fixed item identities; ordinary equipment stats and
admin editing stay unchanged.

Boots apply after the food modifier with identical rounding in browser prediction
and the authoritative action context. Roll distance, action length and immunity
are unchanged. Carrying boots or putting them in an invalid slot has no benefit.

Sword damage checks authoritative enemy state at impact. Skeletons mark recovery
only after finishing their attack; flinching because the player hit them does not
open a bonus window. The first counter can stagger them, ending that window.
Wildlife uses its existing post-attack cooldown. The active hand, rather than
backpack contents or an off-hand sword, determines eligibility. No random rolls,
new currency, item IDs, assets or packet fields are needed. Item descriptions keep
the traits visible even when an admin changes the flavor text.
