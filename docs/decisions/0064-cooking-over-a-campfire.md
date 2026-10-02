# 0064 — Cooking over a campfire

Raw food stays edible, but a lit campfire can turn it into a better meal.

## Decision

While standing beside a lit campfire, hold a perch, trout, golden carp or
piece of meat and press `E`. One piece becomes its roasted counterpart.
Roasted food restores more hunger than the raw version.

The food has to be the active item in the player's hand. Carrying raw food
somewhere else in the pack does not make the interact button cook it.

An unlit campfire keeps the old interaction: `E` lights it. A lit campfire
with no cookable food in hand keeps the old interaction too: `E` puts it
out. If raw food is in hand but the cooked result cannot fit in the pack,
the press does nothing rather than unexpectedly extinguishing the fire or
destroying the food.

Raw food remains edible. Cooking is a reward for coming home and using a
fire, not another survival requirement.

## Why

The game already has fishing, hunting, hunger, campfires, inventory pressure
and a homeward loop. Cooking connects those existing systems instead of
adding another meter or a separate crafting screen.

Using the active item follows the same rule as chopping, fishing and eating:
what is in your hand is what you are choosing to act with. Using `E` keeps
campfire interaction in one place and avoids another key or menu.

Each cooked food is its own item so it can be carried, dropped, shared and
eaten through the ordinary inventory rules. The new item ids are appended to
`ITEM_ORDER`; existing item indices are persisted, so their order must never
be changed.

## Art

Cooked food keeps the deliberately simple low-poly food shapes already used
for raw fish and meat, with warmer browned colours and a couple of dark grill
marks. No external asset is needed.
