# 0207 — Three equipment specialties

## Context

Existing equipment has useful base stats but little identity beyond increasing
numbers. Reuse existing models and reward sources before adding another item tier.

## Decision

Give three existing items fixed, modest specialties:

- Traveler's tunic: 15% less hunger drain while worn in the upper-body slot.
- Winter jacket: 25% faster warmth recovery near an actual lit campfire or fueled
  indoor fire. It does not improve exposed recovery, insulation or cold grace.
- Hunting knife: one additional meat on a meat-bearing animal's finishing blow,
  only when it is the effective active weapon and inventory capacity permits.

The server applies all three. Normal worn-gear persistence suffices, so no save
migration, network fields, new assets or item IDs are needed. Food and clothing
loot tables stay unchanged. Existing attack, movement and animation timing stays
unchanged; these are preparation choices rather than a new combat tier.

Specialties remain fixed to item identity, separate from admin-editable base
stats. Descriptions explain acquisition and conditions. Client tooltips and the
admin player-facing preview preserve mechanical text even with custom flavor
text, preventing an editor override from accidentally concealing a rule.

## Consequences

The camp offers a useful expedition garment, crafting supports winter trips, and
buried treasure can yield a hunting tool with value beyond raw attack power.
Choosing the jacket replaces the tunic's benefit rather than stacking both.
