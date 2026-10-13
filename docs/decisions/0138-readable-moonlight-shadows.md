# Readable moonlight shadows

## Context

At midnight, the very dark hemisphere colours left characters, grass and trunks nearly black when moonlight was blocked. Cloudy nights made the directional light weaker still, making ground contact and silhouettes hard to read.

## Decision

Lift the existing nighttime hemisphere fill with muted blue-grey sky and ground colours and a modest intensity increase. Keep nighttime fill below 15% of the daytime fill. The same day-brightness curve still blends it smoothly through dawn and dusk. Keep the existing sky, fog, moonlight shadows, cloud attenuation and underground light multiplier.

## Consequences

Outdoor shade remains readable without adding lights, new shaders or extra draw work. Night still looks dark, firelight still provides local contrast, and tunnels still strongly attenuate exterior light. Before/after game captures use the same player, clearing, camera and server clock at midnight, midnight in a blizzard and noon. The optional browser capture helper renders only the saved frames on CPU-only machines.
