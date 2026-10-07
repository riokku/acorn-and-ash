# Tab targeting

The client already tracks raiders and wildlife from authoritative snapshots, aims
attacks through `aimYaw`, and draws combat feedback through `CombatFeed`. Selection
uses these systems without adding network messages or changing damage rules.

Tab selects a living hostile within 30 metres (including height), preferring a
120-degree cone around the player's facing. Within each group, distance plus
angular offset ranks candidates; entity ID breaks ties. Further presses cycle a
stable list in either direction (Shift+Tab reverses it). New arrivals join the end,
invalid entries leave, and losing the selected target clears the cycle. The first
press in either direction acquires the best candidate. Peaceful wildlife and
players cannot be selected.

A gold diamond and name mark the target in the existing combat overlay; offscreen
selection uses the overlay's directional ring. A selected raider's existing health
bar stays named. Within the existing melee assist range, selection takes priority
over automatic aim assistance. Selecting alone does not turn the camera or player,
attack, or extend weapon reach. The server still decides what each blow hits.

Death, despawn, range, knockout, disconnect, and changing spaces clear selection.
Escape closes panels first, then clears selection, then pauses. Tab is captured
only during active gameplay outside panels and editable/focusable UI. Holding Tab
does not cycle repeatedly. Existing input disposal and blur handling discard
pending targeting presses.
