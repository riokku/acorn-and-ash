# Camera comfort on uneven trails

The player position already interpolates between simulation ticks, but a small step up onto uneven terrain moves the whole camera vertically at once. Ease the camera's followed height only while the player stays grounded outdoors. The lag is capped at 18 cm and settles in a fraction of a second; horizontal tracking, aim, feet and collision are unchanged.

Jumping, falling, rowing, doorway changes, large relocations and returning after a long frame use the player's height immediately. Zero-time aim updates preserve the current easing. Terrain, near-plane and blocker clearance still run against the final followed target, including the existing post-shake safety check.

This is visual comfort only. Shared movement rules and server prediction remain identical, with no extra movement latency or new control bindings.
