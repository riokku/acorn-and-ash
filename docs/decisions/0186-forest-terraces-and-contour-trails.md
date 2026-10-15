# Forest terraces and contour trails

The lowland wilderness was mostly small noise hills. It lacked shelves to pause
on, distinctive changes of elevation and readable ways up the mountain.

Add three wooded terraces, a sloping foothill, a mountain shoulder and a snowy
overlook, with irregular edges and broad aprons blending into the seeded hills.
Three connected trails lead
from the clearing through the cedar bench, up to the lake overlook and along
switchbacks to the snowy ridge. Their sampled curves include gentle authored
elevations, so a trail provides a physical walking surface in every world rather
than just painting over a cliff. The starting clearing stays flat. Water shaping
still forms the beds and shores, and trail grading stays away from water.

The shared relief and trail lookup drive authoritative terrain, prediction,
scenery clearance and the client's existing forest-floor paint. No new art
models or textures are introduced. Nearby segments are indexed into 16 m cells;
only terrain around the narrow trails gets extra mesh detail. Digging retains
its original cell grid and uses the refined surface's existing lattice.

Seeded scenery decisions use the original terrain before assigning IDs, then
plant models at the new height and filter paths and steep banks afterwards.
This prevents saved chopped-tree IDs from shifting to different trees. Elevated
trees use conifers and remain below the existing tree line. Generated encounter
glades may relocate to meet their flat-ground checks and stay clear of trails;
their IDs and discovery rules are unchanged. This terrain update applies to
existing worlds too; there is no per-world terrain version or save reset.

If random resource placement misses suitable foothill pockets, a bounded sweep
uses the same slope, spacing, water and scenery checks to fill the remaining
deposits. Stone and ore retain separate ID ranges even when a site is blocked.

`?gallery=forest-trails` shows the actual seeded map with three orbitable
viewpoints. Tests walk every complete route with scenery, encounter and water
collision, sample grades and tread width across seeds, check tree identity and
water beds, and compare rendered terrain with physical ground.
