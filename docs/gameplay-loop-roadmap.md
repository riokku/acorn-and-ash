# A reason to venture out and return home

**Status:** authorized October 3, 2026; Chris selected all recommended options.

Chris requested all seven recommendations in order, including increasing housing
blueprint drop chances after unsuccessful skeleton kills. The intended loop is:
prepare at home → explore and take manageable risks → earn useful finds → return
to improve and personalize the home → prepare for a new opportunity.

## Delivery order

Each stage should be a focused, playable PR with a preview and browser review
steps. Preserve existing worlds, learned housing skills and private chest contents.
Do not merge PRs automatically. Record accepted rules in short decision records.

1. **Distinct skeleton encounters and reliable blueprint progress.** Give lone
   wanderers, guarded ruins and nighttime patrols recognizable behavior and visual
   cues. Preserve readable attacks, escape routes and safe interiors. Increase
   blueprint chance after unsuccessful eligible kills; persist progress per
   character/world. The agreed curve guarantees the sixth eligible kill; nearby contributors
   get independent, protected rewards. Existing surprise raids remain.
2. **Rewarded discoveries and a journal.** Add hidden camps, logging sites,
   mushroom groves and ruined shrines with useful rewards. Record discoveries and
   leads. Each character earns its special reward once; hints lead to discovery
   and map markers appear afterward.
3. **Housing facilities.** Make successive tiers unlock useful activities, using
   existing cooking and storage rather than replacing them. Tent → teepee → small
   cabin → larger cabin and blueprint learning remain settled. Facilities follow the accepted sequence below; aim for 3–5 hours
   to reach the largest cabin.
4. **Preparation and meals.** Connect gathering, fishing and hunting to a few
   distinctive meals and preparation choices. Keep hunger and energy as the only
   survival needs. Discoveries teach special recipes; one meal benefit can be active.
5. **Changing forest opportunities.** Make weather and time create reasons to
   explore different areas: mushrooms after rain, fireflies at dusk and timber
   after storms. Weather must be shared and server-authoritative. Weather adds no new survival penalties.
6. **Personal expression.** Add furniture, lantern colors, rugs, trophies and
   garden layouts, with some rewards earned through discoveries and accomplishments.
   Ownership remains private. Use free placement and rotation with collision checks.
7. **Rewarding homecoming and forgiving recovery.** Improve warm windows, fire,
   resting feedback and storage interactions. Connect expedition rewards to the
   home. Keep the existing knockout/recovery rule, adding a marker and no expiry.

## Existing foundations

- Skeletons already have four combat styles, warning banners, readable wind-ups,
  one-attacker-at-a-time coordination, bones and learned housing blueprints.
- Blueprint chance is currently a flat 30%; the killing blow chooses the next
  unlearned tier. Learning belongs to a character in its current world.
- Campfires roast fish and meat; raw food remains edible. Crafting has an axe,
  fishing rod and torch. Extend these systems with clear player choices.
- Homes upgrade in place without losing locks or the ten-slot private chest.
- Day/night, procedural wilderness, map exploration and buried-item recovery
  already exist. Build on their saved state and interaction conventions.
- XP remains a later design decision. No timers requiring daily attendance,
  login rewards or paid progression are requested.

## Review and validation

Validate deterministic rules and messages, persistence across reconnect/world
sleep, participant reward ownership, failure paths that preserve items, collision
and interior safety. Check art and complete player flows in the browser. Keep the
HUD quiet and put controls in Settings > Keybindings. Use the established painted
low-poly forest palette, inspect models in-game and respect rendering budgets.

Measure the first-session and repeated-expedition loop against Chris's preferred
session length and progression pace. Review actual play before adding more
systems; each stage must create a reason to use the previous stage.

## Accepted starting balance

- Expeditions: 15–25 minutes; largest cabin: roughly 3–5 hours over several sessions.
- Keep surprise raids and add all three exploration encounter types.
- Blueprint chance: 30%, 45%, 60%, 75%, 90%, then 100%; reset on a drop.
  Persist the streak per character/world. Each nearby contributing fighter gets
  an independent roll and a protected pickup for their next unlearned tier.
- Discovery special rewards: once per character; hints/sketches before discovery,
  map markers afterward. Ordinary gathering remains shared.
- Facilities: tent rest/storage, teepee cooking, small cabin workbench, larger
  cabin garden. Outdoor campfires stay usable.
- Basic recipes known; special recipes learned through discoveries.
- One temporary meal benefit at a time: stamina, healing or gathering.
- Weather creates resources and atmosphere, with no new survival penalties.
- Furniture can be placed and rotated freely, subject to collision checks.
- Keep knockout/buried-item recovery; add a recovery marker and no expiry.

Minor tuning and content
choices can be proposed in each playable PR; do not introduce XP or additional
survival meters.
