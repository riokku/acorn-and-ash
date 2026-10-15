# Progressive tree fires

Trees previously carried a low flame effect for a fixed 55 seconds, then became
stumps instantly. Torch and lightning ignitions now share a size-based lifecycle:
45 seconds for a 14 m tree, scaled by the square root of height and bounded to
30–75 seconds. Building fires retain their 90-second lifetime. Active-world time,
seasonal ignition/spread, fire damage and existing population caps stay unchanged.

The shared burn clock drives an upward flame front, reaching the crown at 80%
of the lifetime. Bark and foliage darken progressively from the roots upward.
Each instanced tree part has a burn attribute; its original seasonal tint remains
live, and both detail levels and repacked forest slots preserve the right tree's
soot. Existing authored flames, smoke, embers and the fixed firelight pool are reused.

Burnout starts the existing size-aware tree fall in a seeded direction, with no
logs or sticks. Chopping a burning tree also yields no usable wood. A new optional
`burned` tree state uses a spare network flag and an additive SQLite column whose
old-save default is false. It keeps the falling tree and stump charred across
reconnects, without replaying completed falls. Normal regrowth clears the flag.

`?gallery=tree-fires` demonstrates small, ordinary and mature trees, plus an
unburned neighbour. `&at=20&still` inspects a frozen stage; the ordinary tree falls
at 45 seconds. No replacement models or textures are introduced.
