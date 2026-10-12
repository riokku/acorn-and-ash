# Readable water depth

The lake and river depth tint previously blended over 0.65–1.8 metres of water depth. At the 0.8-metre wading limit the blend had barely begun, making the walking barrier hard to predict. Sloughs also used distance from shore to darken their centers, even though their beds are shallow.

Derive the color range from the existing wading limits: start at 40% of the limit and finish at 120%. Smoothstep gives about 84% of the depth ramp at the limit, while keeping ordinary shallows mostly clear and retaining a gradual transition. Both the main lake and river pools use this range.

Sample physical depth under graded slough surfaces from their local water level and terrain floor. Use the same sampled-depth color calculation at river/slough joins. Pack the river's additional physical-depth value into its existing interleaved vertex buffer; retain the original stream-depth value used to describe river pools and their collision threshold. Lake-mouth shading still uses the lake's exact color and ripple calculation, avoiding a new seam.

This changes appearance only. Terrain, water surfaces, current, wading limits, boats and freeze/thaw rules retain their behavior. No new model or texture assets are introduced. Regression checks cover clear shallows, visible darkening at both walking limits, continuous color progression, sampled slough depth and WebGPU vertex-buffer budgets.
