# 0101 · Reeds at every body of water

## Context

[Decision 0099](0099-mature-reeds.md) made some reeds "mature": tall, golden and cuttable, coming back somewhere else after a random fifteen to twenty-five minutes. It put them at the lake only, because the lake was where the reeds already were and where the rowboat goes. Chris then asked for reeds at every body of water and kept the timer as it was. The world has two: the big lake in the north-east and the small pond in the home clearing.

## Decision

- **Each water has its own beds.** The lake keeps its six, and the pond starts with two on its east bank, about 7 m apart. Both are cut with E, hold two to six, and come back after the same 15–25 minutes.
- **A bed always comes back at its own water.** A pond bed moves round the pond's shore and a lake bed round the lake's. None ever wander from one to the other, so both always have some.
- **The numbers are per water**, in one table (`REED_WATERS` in `world/reeds.ts`). A lake bed keeps 14 m from the other beds that still have reeds and moves at least 10 m when it comes back. The pond is small, so its beds keep 6 m and move at least 4 m. It has 12 places a bed can return to, about 1.5 m apart. A new water is one more row.
- **The pond keeps its beds clear of what the clearing already puts there**: the fishing rod, the flowers, the first sticks, the axe stump, the bag and where you arrive. Each is kept at least 4 m away, so one press of E never means two things. A bed that is returning also steers clear of dropped piles and buried caches, here and at the lake.
- **Old worlds load as they were.** The lake's beds keep their numbers (100–105) and the pond's are new (106 and 107). A saved bed is only believed if it stands on the shore of its own water.
- **Boats are unchanged.** Rowboats are for the lake ([decision 0092](0092-rowboat-mooring.md)), so a pond bed is somewhere to cut reeds, not to moor.
- **Scenery reeds at the pond stay clear of the mature beds**, the way they do at the lake, so a golden bed is never hidden in a green clump.

## Consequences

- **Rope no longer needs the long walk to the lake.** There are reeds a few steps from home from the first minute. That is what was asked for, but it does change how early rope and the rowboat feel. Chris should say if the pond should have fewer beds.
- A world with the pond's two beds cut can have none to cut at the pond for up to 25 minutes. The lake is still there, and any bed comes back on its own.
- The reeds browser test now runs at both waters. It skips the drawing like the older tests ([decision 0100](0100-browser-tests-skip-the-gpu.md)), because the clearing is busy enough that software drawing left the page too slow to send a press of E for seconds at a time. The helper that does this moved to `e2e/skip-drawing.ts`, shared with `play.spec.ts`.
- The server still only says where each bed is and how many are left. Nothing new goes over the wire.
