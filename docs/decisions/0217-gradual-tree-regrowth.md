# Gradual tree regrowth

Trees previously returned at their generation's full size, and could immediately
be harvested again. Regrown trees now start at 18% scale after the existing
stump wait. The existing seeded generation determines their varied mature size;
a separate growth clock takes 24–36 minutes, centered on Chris's requested
30 minutes. Initial trees and old saves without a growth clock stay mature.

The server persists the real-time start and the current growth byte (0–255).
Each small size change updates standing props, collision and a tree-state delta.
Clients apply the same byte to near/distant meshes, camera blockers, reach and
falling trees. Growth waits when expansion would overlap a nearby player.
Offline time counts; a world waking after a long absence catches trees up.
Felling freezes its current size and restarts the usual stump wait. Only a
mature, unburned tree drops logs or sticks.

The tree-state header flags its new 17-byte records; decoding retains both
previous 16-byte layouts and the original 4-byte records, with absent growth
meaning mature. SQLite columns are added with mature defaults, preserving old
worlds. No new models or textures are required.
