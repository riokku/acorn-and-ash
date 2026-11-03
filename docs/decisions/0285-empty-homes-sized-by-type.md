# 0285. Empty homes, sized by type

**Status:** accepted · **Date:** 2026-11-03

## Context

Every home's room was the cabin's room scaled up or down, and every one came
furnished: a bed, a chest, a table and chair, a shelf, a rug and a lamp (see
0055). Chris asked for the room's size to follow the home type, and for homes
to start empty but for their fire, with the furniture built instead. Asked
directly, he chose:

- rooms of 4 × 4 m for a tent, 5.5 × 5.5 m for a teepee, 7 × 6 m for a cabin
  and 10 × 8 m for a large cabin;
- a small open fire in a tent, an open fire in the middle of a teepee, and a
  stone fireplace in both cabins;
- nothing else to start with, and no bedroll: until a bed is built, a
  knocked-out player wakes on the floor beside the fire;
- old saved homes are emptied too, but whatever was in their chest waits and
  shows up in the first chest the owner builds;
- four buildable pieces: a bed (6 logs, 2 rope; you wake in it and can lie
  on it), a desk and chair (6 logs, 4 sticks; the indoor workbench, and you
  can sit at it), a storage chest (4 logs, 2 sticks; the same 10 slots) and,
  in a large cabin only, an indoor garden;
- the bed, desk and chest can go in any home that has room, tent included.

## Decision

**Each home kind's room is a row in `HOME_INTERIORS`** (`data/housing.ts`):
its half width and depth, where the door sits, and which fire it has. The
walls, the fire, the entry, the floor wake spot and the room's collision are
all worked out from that row, with no scaling.

**Furniture is decoration.** The four pieces are appended to
`DECORATION_KINDS`, `BUILDABLE_KIND_ORDER` and the decoration request list,
so older wire indices stay where they were. Each has a real box outline in
`HOME_FURNITURE_SHAPES`, used for collision and for checking where it may go:
inside the walls, off the fire and its cooking spot, clear of the door and
the wake spot, and with room to stand at the bed and the chair. A home holds
one of each (`onlyOne`). The chest, workbench, garden, bed and chair are all
found by looking for the built piece, so they work wherever it was put.

**Contents stay keyed by home.** The chest's slots and the garden's plots are
still saved per home id, which is how an old chest's contents reappear in a
newly built one. A chest with things in it, or a garden with crops, can't be
packed up.

## Consequences

- Rooms of different sizes are easy to add or tune: change one row.
- Saved decorations that no longer fit a smaller room are moved in from the
  walls when the world loads (`insideTheWalls`), only as far as they must.
- The indoor garden's cost (4 logs, 6 sticks, 3 flowers) matches the outdoor
  kitchen garden; Chris hasn't picked it yet.
- The new pieces reuse the old code-drawn placeholder bed, table, chest and
  trays, and borrow the nearest painted icons. Their own Blender models and
  paintings come later, one family at a time.
