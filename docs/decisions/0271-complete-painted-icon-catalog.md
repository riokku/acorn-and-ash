# Complete painted icon catalog

Extend decision 0269's reviewed visual treatment to every current item and
buildable, plus the existing health, hunger, settings, season and recovery
compass symbols. Each ID has an explicit mapping; upgraded tools, rare gear,
raw and cooked fish, and shelter blueprints keep distinct illustrations.

Five additional transparent WebP sheets group gear, relics, shelters, food
and decor, and remaining objects with system symbols. OpenAI image generation
created the illustrations at the user's request. The license ledger records
their source. Quality-90 WebP encoding with lossless alpha reduces the new
sheets from 4.5 MB to 1.5 MB without changing dimensions or crop bounds.

Normalize each sprite by measured visible alpha bounds, preserving aspect
ratio. A per-instance React `useId` clip excludes neighboring art even when
the object is narrow. Keep the decorative SVG wrappers, existing control
labels, and original silhouette fallback for future unmapped content.

The icon gallery renders the canonical item and buildable catalogs and system
symbols at 13, 24, 30 and 40 pixels on paper and fir. Coverage tests follow the
catalogs rather than freezing their current length. Reviewed HUD evidence
includes day/night, warning values, reduced motion, hotbar selection, keyboard
focus and narrow desktop layouts. These controlled UI captures are not an
online playthrough or a performance benchmark.
