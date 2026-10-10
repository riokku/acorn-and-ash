# 0120 · Sandy riverbanks

Chris asked for a softer transition between river water and land.

Blend a narrow, irregular band of sand along the river and its connected sloughs, using the existing soil texture with a sandy palette. Dampness darkens the inner shore; coverage fades into grass and drops away on steep faces. Grass density follows the same bare-ground coverage. Snow overlays the sand normally.

Store coverage and dampness together in one ground vertex attribute, keeping the ground within WebGPU's minimum eight-buffer limit. Preserve both values when digging subdivides the ground, and supply zeros in the art gallery. Widen the river's transparency feather and reduce the bright shoreline highlight so the riverbed shows through at the bank.

This is a visual change: terrain, collisions, water depth and gameplay remain unchanged. No new model or texture assets are needed.
