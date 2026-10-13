# Camera view edge clearance

The outdoor camera previously checked scenery with only its center ray, while
terrain already protected the view corners. A grazing trunk or rock could cut
into the near plane even when the center missed it. The minimum scenery distance
could also force the camera past an obstacle close to the player.

Use the existing center/corner sweep for scenery as well as terrain. Scenery
probes use the actual near-plane corners so narrow obstacles are not skipped by
an oversized margin. Terrain keeps its existing extra margin. Allow the camera
to pull closer than the old minimum when necessary, retaining immediate pull-in
and eased recovery. Recheck scenery and terrain after impact shake.

Checks still use existing BVH collision meshes and five probes per object;
shorten subsequent ray lengths once an obstruction is found. Indoor dollhouse
framing and mouse controls remain unchanged. No meshes or draw calls are added.

Validation covers grazing view edges at normal and ultrawide aspects, nearby
obstacles, repeated turns/shake, terrain slopes and indoor framing, plus browser
camera dragging and world-loot interactions.
