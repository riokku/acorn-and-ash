# Solid outdoor props and landmarks

The scenery audit found more visible solid parts without movement collision: fences, outdoor decorations, free boat hulls, trail cairns and a discovery log. Homes and indoor decorations already registered bodies.

Register deterministic primitive bodies matching the solid parts of each placed prop on client and server. Model dimensions, rather than build-placement clearance radii, size them. The kind switch is exhaustive so a new buildable needs an explicit collision decision. Rugs, inset paths, leaves, flowers and flames remain walkable decoration; their solid containers/posts/logs block the body.

Register bodies on placement and restore, remove them with abandoned/stranded pieces, and leave the initial forest/stump indices intact. Free hull bodies track actual shared drift on the server and the displayed predicted pose on the client. Remove the placed hull while occupied: rowing owns its rider and hull, then restore it on release. No speed, recipe, reach, controls or jump changes.

Trail cairns use the existing shared stone triangles and support landing. Ruin blocks and the discovery log get matching bodies while retaining the same landmark positions and open centers. These simple colliders conservatively cover small decorative details; this remains kinematic movement, without a new physics engine.
