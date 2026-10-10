# 0116 · Reactive water and river ice

## Context

Chris found that sloughs stayed open during blizzards while the lake froze, and asked for more natural-looking water that responds to characters moving through it.

## Decision

- Apply the existing server-controlled lake freeze state to the river and all six sloughs, including when joining an already-frozen world. Swap open water for ice, hide floating lily pads and flowers, and restore them on thaw.
- Pass the river into the outdoor collision world on both client and server. Frozen river and slough walking heights match their sloping ice surfaces, 5 cm above the water. Thaw restores the original floor.
- Characters moving through open water leave expanding, damped surface waves. Walking and running produce different strengths; standing still, teleporting and moving on ice produce none. Local movement and interpolated remote movement drive the same effects.
- A shared pool holds at most twelve disturbances. Shader uniforms update existing materials; no meshes, textures or network messages are created per step. Waves die away after three seconds and are cleared on freezing or world changes.
- Add small animated surface normals, softer painted ripple highlights, and stronger sky-colored shading at grazing angles. Preserve the existing river current and the gradual motion transition into each slough.
- Interleave the river's custom vertex attributes in one buffer. Together with position and normal this uses three vertex buffers, within WebGPU's guaranteed limit of eight; separate attributes previously required nine and prevented the river pipeline from rendering on such devices.

## Consequences

Ice is both visible and walkable. Open water reacts to movement while keeping the game's stylized palette. This is visual wave behavior driven by character movement, not a fluid solver or a change to swimming, buoyancy, harvesting or fishing rules. The Water Pro link was a visual direction; no third-party shader code or assets are imported.
