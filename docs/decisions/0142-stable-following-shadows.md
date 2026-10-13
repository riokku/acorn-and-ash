# Following shadows keep a stable sample grid

## Context

The daylight shadow camera followed every tiny change in the player's position. This moved its texture sampling grid continuously across static trunks, rocks and grass, contributing to shimmering edges during walking.

## Decision

Keep the existing directional-light offset and shadow coverage, but round the camera target to whole shadow texels in its own right/up plane. Read texel size from the current shadow resolution and orthographic bounds, and retain movement along the light's forward axis. Initialize the configured projection matrix explicitly. Select the supported PCF shadow mode instead of its removed soft variant, which Three.js already replaced automatically.

## Consequences

Small steps leave static scenery on the same sample grid; larger steps move the map by whole pixels while its centre stays within half a texel per axis. The light direction and lighting strengths do not change, and there are no new lights, shaders or draw calls. Projection tests cover two resolutions, slopes and distant coordinates.
