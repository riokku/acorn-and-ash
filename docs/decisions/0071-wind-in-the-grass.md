# 0071. Wind in the grass

## Context

Chris asked for grass with wind animation, similar to Grassworks, while keeping
Acorn & Ash's stylized Pacific Northwest forest. The ground previously had a
painted grass texture but no moving blades.

## Decision

Add original procedural five-blade clumps drawn with one instanced mesh. A node
shader bends their tips in broad, traveling gusts with small local flutter. The
same material works through WebGPU and the WebGL 2 fallback. Roots remain fixed,
and distant clumps shorten smoothly into the painted ground.

Only grass within 32 metres is drawn, with an 18,000-clump ceiling. Seeded tile
samples are cached within a bounded neighborhood; moving across a tile boundary
never rearranges overlapping clumps. Bare forest floor, steep slopes, water,
spawn traffic and built-piece footprints exclude grass. New buildings clear it
immediately. Grass is visual and never blocks walking, camera rays or loot.

Settings includes a saved density slider, including zero to disable the effect.
Reduced-motion preferences stop the wind animation. The grass uses no external
artwork or Grassworks code.

## Consequences

The world needs no new messages or saved grass state. Initial generation happens
before the loading screen's first rendered-world milestone. Ordinary updates
reuse cached samples; crossing tile boundaries generates only the new tiles.
The existing painted ground remains the distant and disabled-detail fallback.
