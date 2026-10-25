# 0241 — Keep overlapping loot selection dependable

Hover selection ran fresh ray tests every 80 ms, so nearly coincident/bobbing surfaces could alternate tooltips. Clicking also queried independently of the displayed target. Keep the previous loot request as a preference only when it still intersects the pointer and is within 4 cm of the nearest visible surface. Direct hits still precede the existing 3 CSS-pixel offset samples; clearly nearer items win.

Every query rebuilds candidate ownership and transforms and rechecks scenery occlusion. Removed, hidden, depleted and moved items cannot remain selected. The click uses the same preference with fresh geometry/reach/capacity checks, then sends the existing exact-target request. Keyboard E selection and server authority stay unchanged.

Loot transport now reports whether it actually submitted, matching other deliberate actions. Failed/disconnected clicks and local reach/capacity refusals publish feedback immediately instead of waiting for a HUD refresh. Inventory and collection effects still wait for the server. Tests cover overlapping preference, disappearance/visibility/distance/occlusion, cursor restoration and no offline request replay.
