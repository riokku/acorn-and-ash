# Discoveries that reward exploring

## Context

Chris wants 15–25 minute expeditions, personal discovery rewards, hints and
sketches before discovery, and map markers afterward. Basic recipes stay known;
special recipes are learned through exploring. Ordinary gathering remains shared.

## Decision

Four seeded encounter glades also hold a forgotten camp, logging site, mushroom
grove and mossy shrine. Walking within six meters records a location. Inspecting
within reach grants its once-per-character supplies and recipe, provided nearby
guards are gone and the entire reward fits. Finding and claiming are separate:
a full pack never consumes a reward. Inventory and discovery state save together.

The existing C journal has Crafting and Discoveries tabs, with painted sketches,
clues, learned-recipe notes and markers only for found locations. No new permanent
HUD panel is added. Berries and mushrooms use shared, regrowing gathering patches;
their growth stays near their original glade. Camps teach a portable ration,
groves a stew, and shrines berry tea. Stew and tea require a lit campfire. Meal
benefits and home cooking stations follow in their authorized roadmap stages.

## Consequences

Discovery knowledge survives reconnects and world sleep independently for each
character. Existing item and recipe wire indices remain stable. New SQLite state
is additive; existing homes, scenery, chests and learned housing tiers survive.
Landmarks and foods use original painted low-poly geometry within prop budgets.
