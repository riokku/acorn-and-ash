# Forest detail packing work

Every periodic detail pass previously rewrote all standing tree transforms,
uploaded both instance buffers and recomputed all bounds, even when the player
had moved without changing any tree's detail level.

Keep the existing packed slots and update transforms only when their mesh or
index changes. Update buffers/bounds only for changed meshes or counts. Tree
appearance changes still refresh transforms, and falling/shaking keep their
existing animation paths. Removed instances cannot leave a stale slot behind.

A local 1,000-tree, 60-pass CPU benchmark reduced median detail work from 2.39 ms
to 0.97 ms and the 95th percentile from 4.78 ms to 1.95 ms. This measures the
periodic CPU work, not GPU performance or total frame rate. Tests retain exactly
one detail level per tree and cover regrowth, falling and unchanged buffers.
