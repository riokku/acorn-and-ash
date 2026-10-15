# 0183 — Complete weapon and clothing bonuses

## Context

Chris wants stats on every weapon and clothing item. The existing equipment
system supplies attack, protection, maximum-health and warmth bonuses, but basic
tools and several hats had missing bonuses.

## Decision

Keep the existing percentage-based attack system and label it `Attack power`.
Iron sword stays +50%; hunting knife/refined axe +25%; axe +10%; refined rod
+10%; rod, shovel and torch +5% when used as an improvised weapon. Only the
active main-hand item affects damage. Gathering and fishing retain their rules.

Every head/body/leg/feet/hand garment supplies both protection and warmth.
Knight's helmet gains warmth 5; bear hat gains protection 2%; mage hat and rogue
mask gain protection 1%. Existing clothing and maximum-health bonuses remain.
The helmet favors protection; the fur hat and padded jacket favor warmth.

Bonuses use the shared item table, shown in pack/gear tooltips and replacement
comparisons. Server-authoritative equipment rules, total caps and save formats
remain intact; an item in the pack contributes nothing.

## Consequences

All usable weapons and clothing have explicit, readable benefits, without a
second stat system or equipment migration. Balance stays modest and editable as
item data. Item-description copy must agree with these bonuses.
