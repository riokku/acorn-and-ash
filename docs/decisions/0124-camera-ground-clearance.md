# Camera clearance above rendered ground

The follow camera checked props, buildings and dug walls but ignored the outdoor terrain. Orbiting upwards or into a steep hill could place it below the world.

Give the outdoor camera the visible ground mesh as a separate obstruction. Sweep its centre and near-plane corners along the orbit, pull in immediately before reaching ground, and ease out after clearing it. Terrain can require a closer view than the existing minimum distance to props. Recheck the final shaken position so combat shake cannot push the view underground. Apply the same guard to the immediate camera update used by click aiming.

Build an indirect ground BVH to keep per-frame raycasts inexpensive without reordering the coarse or refined cell indices used by digging. Hidden ground triangles remain hidden to camera rays; their old bounds stay conservative for triangles that remain. Indoor dollhouse framing retains its existing behavior, and the camera can still enter excavated openings with the dug walls providing collision.

Regression tests sweep steep slopes through yaw, upward pitch and shake, verify near-plane corners stay above the surface, check easing back out, and verify removed triangles and indoor framing.
