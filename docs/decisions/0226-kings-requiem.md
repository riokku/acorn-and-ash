# 0226 — King’s Requiem

## Context

The director requested an exceptionally cool epic weapon from the Hollow King,
with moving enchantments reminiscent of classic MMO weapon effects. The existing
boss reward was an ordinary watch greatsword. Blender is unavailable in this
cloud session, so this pass reuses that existing weapon geometry.

## Decision

King’s Requiem is a new append-only main-hand item, with epic rarity, +85% default
attack power and knockout protection. Each recent contributor receives one
personal sword on victory through the existing boss reward callback. It replaces
the guaranteed watch greatsword. The king does not also roll a public copy.
Ordinary skeleton weapon chances and existing item IDs stay unchanged. The sword’s
name, description, rarity and power remain editable through the admin catalog.

Its physical shape, grip and reach reuse the watch greatsword. Separate materials
give it violet steel and gold fittings. Three.js node materials animate a tapered
travelling sheen, two cyan/violet energy strands and twelve orbiting sparks.
These are visual effects, attached in weapon space; they do not add damage,
collision, textures, dynamic lights, simulation state or network traffic. One
shared set of parts serves the boss, player, ground pickup and gallery. Effect
surfaces neither cast shadows nor raise the physical ground-rest height.

Motion uses the renderer’s GPU clock, with no per-weapon timers or frame allocations.
The admin inspector copies its own geometry/materials and renders continuously
only for the visible animated item. Switching to a normal item returns it to
on-demand rendering; hiding the tab or disposing the inspector stops that loop.

## Consequences

The weapon is a clear step above the watch greatsword without changing attack
controls or reach. Browser tests must compile the actual shaders and verify
visible motion and admin switching. Complete shared catalog tests guard saves,
wire IDs, equipment and loot. A future Blender art pass can replace the physical
blade while keeping the item identity and enchantment behavior.
