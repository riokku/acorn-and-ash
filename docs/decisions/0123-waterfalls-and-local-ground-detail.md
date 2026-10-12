# Waterfalls and local ground detail

The river's falls dropped over 2.4 metres while the visible terrain used 2.5-metre squares. Terrain triangles bridged the curved channel and cut through the waterfall, even though the analytic bed was below the water.

Spread each fall over 4.5 metres while retaining its drop and downstream endpoints. Subdivide ground cells around the five falls into eight divisions per axis (about 31 cm), sampling the shared terrain at the added vertices. Keep the rest of the world at its existing resolution. Boundary vertices meet adjacent coarse triangles exactly, so the refined patches leave no cracks. Retain the original coarse cell indices and record each patch's extra index range so digging can hide both. Ground lattice sampling reads the refined triangles and their paint and normals.

Add deterministic, varied groups of the existing stone geometry around each waterfall bank. Keep them outside the flowing channel and extend their bases into the terrain using the existing burial helper. These are scenery like the other riverbank stones.

The refinement adds vertices only around the falls and retains the existing ground attributes and WebGPU buffer budget. Shared fall profiles keep client prediction, server collision, current and winter ice aligned. Tests compare the rendered ground against water along all five falls across two seeds and check refined-cell digging removal. No new model or texture assets are introduced.
