# 0107 · The dwarves are built from Blender scripts and coloured with vertex colours

## Context

Chris chose dwarves (one male, one female) as the game's own people, in a chibi style that sits next to the Quaternius characters: a head about half their height, stubby limbs, big glossy eyes. They were made through the Blender MCP (decision 0105). Two problems came up while building them:

- Drawn by hand in a live Blender scene, every round of feedback ("shorter", "cuter", "fix her nose") meant redoing work, and nothing recorded how a model was made.
- The first versions took their colours from a tiny palette texture. At glancing angles the renderer samples a blurred, smaller copy of a texture (mipmaps), so neighbouring colours bled into each other. The same would happen in the game at a distance.

## Decision

- **Characters and the iron axe are built by Python scripts in `tools/art/`**, run inside Blender through the MCP: `dwarf_build.py` (shared shapes, rig, faces, hair), `dwarves_species.py` (Dorrin and Hilde), `dwarf_anim.py` (their eight moves), `iron_axe.py`, and `dwarf_preview.py` (the preview stage). The `.blend` and `.glb` files in `assets/` are their output. A change is made in the script and the model rebuilt, so any version can be remade.
- **Colours are vertex colours, not a texture.** Each corner of the mesh carries its colour, darkened a little where it faces down and lightened where it faces up, which gives the soft top-lit look of the Quaternius pack without any lighting cost. With no texture there is nothing to blur, so nothing bleeds.
- **One skinned mesh per character with blended joint weights**, so shoulders, elbows, knees and the waist bend smoothly. Short rings (cuffs, bracers, boot tops) are flat bands, not capsules, so no hidden rounded ends poke through when a joint bends.
- **Same native scale as the Quaternius characters** (about 2 m before the game's 0.6 scale), under the 10k triangle player budget.

## Consequences

- The dwarves only appear in the art gallery for now (`?gallery=dwarves`). Making one the player character is its own change: the animator, the hand bone for held items, and the collision shape all need matching up.
- Vertex colours suit flat, painted colour. Anything that needs real detail (wood grain, a printed pattern) would still use a texture, kept large enough not to bleed.
- Scripts are the source of truth, so hand edits made directly in a `.blend` would be lost on the next rebuild unless they are copied back into the script.
