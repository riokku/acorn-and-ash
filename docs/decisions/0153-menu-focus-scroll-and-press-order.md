# Menu focus, scroll and press order

Menus used separate frame-order toggle checks. Quick presses could open the
wrong final panel, and Escape could close a slot menu and its pack together.
Panel recreation also discarded focus/scroll context, while interrupted gear
drags could leave glowing slots and listeners behind.

Queue fresh menu presses in event order, including Escape; auto-repeat does not
add toggles. Clear the queue with other controls on pause/recovery. Existing
single-toggle consumers also remove their queued entries. Ordinary panels focus
an inert root, retain journal/page scroll positions and restore connected focus
on closing without trapping world movement. Existing Settings/chest behavior
remains intact. Context menus consume Escape before game input. Gear dragging
cleans up on drop, blur, Escape and panel closure, retaining native cancellation.

Panels have an 85 ms opacity-only arrival fade with immediate input/focus and
immediate closure. Reduced motion disables it. Browser checks exercise focus,
scroll, rapid switching and first-Escape cancellation; controls tests cover
ordered presses, repeat suppression and clearing queued input.
