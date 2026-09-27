# 0055. Going inside your home

**Status:** accepted · **Date:** 2026-09-27

## Context

Chris asked to be able to go inside your home, and eventually decorate it.
Asked directly, he chose:

- a room of its own behind the door, roomier than the outside suggests, seen
  like a dollhouse, rather than walking into the cabin model itself;
- the owner decides whether visitors may come in: the door is open or locked;
- going inside first, and decorating in the next pull request;
- a starter room with a bed, a glowing hearth, a table and chair, and cozy
  touches: a rug, a shelf, hanging herbs, a lamp.

The settled design already said you wake up in your bed after a knockout.
Until now you woke up outside your front door, and cabins were not even
solid: you could walk straight through one.

## Decision

**Every player is somewhere: outdoors, or inside one home.** The server keeps
a `space` per player (0 for outdoors, or the built-prop id of the home they
are inside). A room has its own coordinates, and every room is laid out the
same for now (`world/home.ts`), so one set of walls and furniture colliders
serves them all. You only see, and are only sent, whoever is in the same
space as you. Wildlife stays outdoors, and nothing out in the world
(trees, water, pickups, building) is in reach from inside.

**The door is a doorway you walk into.** A cabin is now a solid block, with a
doorway in front of its door. Walking at the doorway, or pressing E there,
takes you in if you are the owner or the door is open. Inside, walking into
the door takes you back out onto the doorstep. Either way the server moves
you and says so with a new `Space` message, since a room's coordinates mean
nothing out in the world. A short breather after each trip stops one push
from bouncing you straight back. Your browser starts fading to dark the
moment you walk at a door, so the switch never pops.

**Home is where you wake up.** Arriving in the world, or coming round after a
knockout, puts a player with a home beside their own bed. A player saved
while inside a home, their own or somebody else's, is saved on its doorstep,
so they never come back to room coordinates out in the world.

**Locked or open is the owner's call.** A new `SetDoorLock` message locks or
unlocks the sender's own door, and nobody else's. It is saved with the home
(a new `locked` column) and travels to everybody on the built-prop list
(a new flag), so a visitor's hint can say the door is locked. Locking stops
new visitors. Anybody already inside stays until they leave.

**The room is built in code** (`scene/home-interior.ts`) from the painted kit
from decision 0053, plus two new textures, a patchwork quilt and a braided
rag rug. It has log walls with a window each side and one at the back, a
plank floor, a stone hearth with the campfire's animated flame and a
flickering light, a four-poster bed with a chest at its foot, a table and
chair by the window with an oil lamp, a shelf of books, jars and crocks, a
box of split logs, herbs drying from a beam, the rug, and a doormat. It is
under 40,000 triangles.

**Seen like a dollhouse.** Inside, the camera looks in from the door side,
high and fairly steep. It swings a little either way with a right-drag, but
never far enough to turn the room side on. Whichever walls it looks in
through are cut down to their bottom log, and there is no ceiling. There is
no sky and no fog, just a warm dark backdrop. The fire and the lamp glow
brighter at night, and the windows go dark. Coming out, the camera looks at
you from out front with your home behind you.

## Consequences

- Cabins are solid now, from outside and to the camera, which pulls in
  rather than ending up inside one.
- Sitting in the chair and lying in the bed need the new KayKit animations,
  so they come with the animations pull request rather than this one.
- Every room is the same room for now. Decorating (placing, moving and
  turning furniture with the build preview) is next, and will give each
  home its own layout.
- `?gallery=home` shows the room on its own, for checking how it looks.
