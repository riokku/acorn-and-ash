# Equipment Protection

## Context

The approved equipment stats make armor and shields useful as well as visible. The first Power PR supplies the shared table and comparison UI.

## Decision

Protection is an additive percentage of hostile damage reduction: knight's helmet 8, traveler's tunic 4, trousers 3, leather boots/gloves 2 each, wooden shield 15. The existing complete set supplies 34%; the total is capped at 40% for future additions. Only valid worn slots contribute. Gear in the pack contributes nothing.

The server applies this after dodge/untouchable checks at the common hostile-damage entry point. Nonzero attacks still deal at least one damage. Current health keeps fractional precision; display and existing health messages continue rounding.

A wooden shield can be crafted by hand from four logs and one rope, making Protection available through normal play. Other armor retains its existing acquisition rules.

The character panel shows Protection alongside Power, and pack comparisons include losses when replacing protective gear with a cosmetic item. Action timing and movement retain their existing values.

## Consequences

Existing gear rewards offer a modest survival benefit. Armor cannot grant immunity or bypass the existing combat restrictions on changing gear. The later Warmth system handles environmental exposure separately from armor protection.
