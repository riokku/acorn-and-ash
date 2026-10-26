# 0243 — Make This Place Home

A first tent should begin a useful homestead, rather than making the player wait
for cabin blueprints before most home activities become available.

Add three independently placeable yard projects: a trail workbench (8 logs,
6 sticks), a trail pantry (6 logs, 4 sticks, 2 rope), and a kitchen garden
(4 logs, 6 sticks, 3 flowers). All are known immediately, require an owned home,
use its normal protected building boundary, and are limited to one of each per
owner. Materials come from the backpack. Existing home storage can hold supplies
between trips; these projects do not automatically spend chest contents.

The workbench enables existing refined-tool recipes within two meters, including
for neighbors. The pantry adds ten private slots using the existing chest
protocol and atomic inventory/storage transactions. The garden uses the existing
three-plot planting, growth and harvest rules outdoors: owner-only tending,
ten minutes of awake world time, plant one/harvest three. Visitors can see nearby
plant state. Full packs leave ripe plants untouched. Existing indoor facilities
and saves remain unchanged.

Project IDs append to both stable building and reclaim catalogs. The existing
built-prop, chest and garden save tables store their progress, keyed by placed
object ID. Occupied storage and planted crops prevent reclaim. Removing an empty
project clears its simulation/storage state; rebuilding costs resources again
and does not grant repeatable rewards. The journal derives completion from
currently owned pieces, so reclaiming or losing a project updates the goal.

Reuse the actual cabin chest, workbench fittings, timber table and growing boxes;
no new models or textures. The Home journal presents three visible milestones,
material counts, practical benefits and a final Trailstead established rank.
Each completed project visibly improves the yard. Within-object construction
stages, new art, trophy placement, home buffs and winter crop rules are later work.
