# 0185 — Inspect existing item models from the private catalogue

## Context

The owner needs to see an item's appearance alongside its editable data, clear
list filters easily, and reach the catalogue directly from character screens.

## Decision

Reuse the game's held tools, weapons, wearable shells, pickups and dropped-item
models in a lazy-loaded Three inspector. Clothing comes from the same rig and
gear layers, baked into independent display meshes; it does not need a second
art asset. Some game items still use their existing placeholder representation.
The preview owns cloned geometry/materials while borrowing shared textures.

Keep one renderer per editor, cancel stale asynchronous model loads, and dispose
old display meshes and event/resize handlers. Draw on selection, resize or user
rotation, with no continuous animation loop. Support pointer dragging, arrow
keys, Home and Reset view. Graphics failures leave the data editor usable.

Clear filters resets search and rarity without modifying selection or drafts.
Show a direct Manage items link on the welcome/new-character screen and the
in-game character panel (Z), using the server-derived owner capability. Remove
the Settings link. Every admin page/API keeps its independent server permission
check; showing a button is never authorization.

## Consequences

The catalogue shows the same item appearances as gameplay, including all 47
current items, without loading a world or introducing new art. The owner can
navigate straight to `/admin`; ordinary players see no administration button.
