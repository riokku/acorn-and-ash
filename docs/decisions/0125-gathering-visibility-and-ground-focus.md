# Gathering visibility and ground focus

Mouse loot targeting checked props and dug walls but omitted the visible terrain. The gold gathering marker also switched to the hovered object even when the E hint and server interaction priority still selected a different nearby item. Its flat ring could float or disappear into slopes.

Include the visible ground in mouse loot occlusion, using its indirect BVH so excavated openings remain open. Keep the gold marker on the existing keyboard-selected item; mouse targeting continues to use its cursor tooltip and right-click action. Preserve the server's pickup, dropped-pile, then gather-patch priority and reach rules.

Fit both rims of the existing ring to nearby rendered ground. Use shared floor heights in excavated spaces, indoor floor height in rooms, and ice height when frozen. Pulse opacity instead of radius so the fitted ring stays in contact with the slope. Cache the fitted geometry, refreshing after target movement or radius changes and periodically for changes to the ground. Hide outdoor focus when another panel or placement owns the interaction presentation.

No new model, texture, input binding, or authoritative gathering rule is introduced. Tests cover terrain occlusion and removed triangles, slope contact, stable pulse geometry, and refitting after movement.
