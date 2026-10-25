# Learnable foraging habitats

## Context

Existing discovery-site forage and seasonal mushroom flushes provide food, but regrowing patches can move around their glades. Players need places they can recognize and revisit after learning the forest.

## Decision

Add six seeded colonies using reserved one-byte patch IDs 243–248. Three mushroom colonies favor the existing fallen timber at the grove, logging site and raccoon hollow. Three berry colonies grow in gentle canopy gaps 42–115 metres from the home clearing. Candidates must pass normal collision, water and gathering-spacing checks. A site with no suitable ground is skipped.

A colony has a permanent home. Once picked clean, it uses the normal gathering timer and comes back within 1.5 metres of that home, with one extra piece up to the existing maximum. Construction can cover it; blocked colonies wait rather than moving elsewhere or growing through a building. Saves keep normal patch fields, and restored positions must remain in the home area. Existing forage, seasonal flushes, food effects and weather bonuses remain available.

The client reuses the existing berry and mushroom meshes, spreading and scaling their pieces into broader clusters. Pieces remain individually harvestable with the current pickup motion. Nearby hints describe the habitat and explain when a colony is picked clean. No new asset, network message, database table or build restriction is needed.

## Consequences

Exploring and remembering locations becomes useful without a map marker or quest quota. Original canopy determines the berry openings, so cutting trees does not relocate colonies. Existing timber provides mushroom landmarks; dedicated berry-bush art can be a future Blender pass. Preview with `?gallery=forage-habitats`, adding `&before` to compare.
