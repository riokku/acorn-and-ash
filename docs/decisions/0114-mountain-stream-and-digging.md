# 0114 · A mountain range, a stream down to the lake, and digging tunnels

**Status:** accepted; steps 1 (the mountain), 2 (the stream) and 3 (shovel and ore) built · **Date:** 2026-10-08

## Context

Chris wants the map to be more varied: a mountain region with a stream running down it into the lake, and a shovel so players can dig tunnels underground.

Today the ground is a height map (`packages/shared/src/world/terrain.ts`): one height per spot, worked out from the world seed, with nothing about it sent over the network. Hills rise at most 5 m, the world is 300 × 300 m (wall at 150 m) and the lake fills the north-east corner. A height map cannot hold a tunnel, because each spot has only one height.

## Decision

Settled with Chris:

- **Where:** far out, in the south-west, opposite the lake. The world grows from about 300 × 300 m to about 600 × 600 m so the range has room. Everything that exists now keeps its place.
- **Shape and look:** a mountain range with cliffs and rocky slopes. Pine forest thins to bare rock, with snow at the top.
- **Climbing:** gentle slopes can be walked. Cliffs block the way.
- **On the mountain:** ore and stone to gather, a cave entrance, mountain animals such as goats, and a discovery site.
- **Stream:** a winding stream with small waterfalls and rocks, running from the mountain down into the existing lake and getting wider toward the bottom. Players can look at it and wade through the shallow parts. No fishing or swimming for now.
- **Shovel:** crafted. It digs anywhere except the home clearing and cabin area.
- **Digging:** free digging, like Minecraft, with limits on size and depth. Digging gives stone, clay, ore and buried items, including the buried items from knockouts. It costs energy like any other action.
- **Tunnels:** permanent, saved with the world and seen by everyone in it. Underground is dark, so players need a torch (the torch already exists).

How it would be built, to be confirmed when we get to each step:

- **The surface stays a height map**, for the whole world. The mountain and the stream's channel are shaped by the same seeded rules, so the server and every browser reach the same answer and nothing about them travels over the wire.
- **Dug space is stored separately,** as a grid of small blocks (about 0.5 m on a side) that records what has been dug out. Only the mountain region and other dig-allowed ground need one. Each dig is a small message to the server, which checks it (distance, tool, allowed area, energy) and tells nearby players.
- **Saved with the world** in the World Durable Object's database, and only the changes from the seed are saved, so a world with no digging costs nothing extra.
- **Collision** in `packages/shared` learns to treat dug blocks as open space. This is the biggest technical change and gets its own tests.
- **Building a mountain on a height map has limits.** Overhangs and natural caves can't be made from a height map. The cave entrance would be a hand-placed opening into the dig grid.

## Build order

Each step is its own small pull request that Chris can play.

1. Grow the world and add the mountain terrain, with placeholder shapes.
2. The stream and waterfalls down to the lake.
3. The shovel and the mountain's ore and stone, using the existing torch.
4. Digging, starting with a straight tunnel into a hillside, then free digging with limits.
5. Art for all of it, once it is fun, in a Blender session on Chris's computer.

## Consequences

- Growing the world makes the minimap and map, the wilderness scatter, interest management and the saved world's bounds all need to cope with 600 × 600 m. Existing worlds keep the old area as part of the larger one.
- Interest management (32 m chunks, 100 m) will be reused for dug blocks, so nobody receives tunnel data from the other side of the world.
- A world with a lot of digging grows its save data. A cap on dig size and depth keeps this inside the Durable Object limits, and we need to measure it before opening digging to 50 players.
- Permanent, shared tunnels mean one player can dig up the part of the mountain everyone shares. We can add limits or refilling later.
- Free digging is the largest build in this plan and may take several pull requests.

## What step 1 built

- **The world is 600 × 600 m** (the wall moved from 150 m to 300 m out). Hills, the forest and the edge taper now follow the square wall, so the corners are wooded too, not empty. Woodland encounter sites still choose their spots inside the old 150 m reach, so they did not move.
- **The mountain range** (`packages/shared/src/world/mountains.ts`) runs along a ridge in the far south-west, peaking at about 70 m, with a wide gentle foot, and cliff bands across its flanks. Pines grow up to the tree line (30 m), only rocks above that, and the ground is bare grey rock and then snow (from 46 m). Rock and snow show on the map too.
- **Cliffs block the way.** The steepest slope a player can walk up is 0.85 (about 40 degrees), rise over run. The server and the browser use the same rule: walking into a cliff slides along it, and a jump cannot carry anyone up a face. A test finds the highest ground reachable on foot and checks that you can get most of the way up the range.
- **The collision loop got a grid.** The bigger forest means about 7,000 trees and rocks rather than about 1,500, and checking every one for every player blew the 10 ms tick budget (about 17 ms with 50 players). Collision now looks only at the trees near the player, which is faster than before the change (about 1.5 ms mean with 50 players) and gives the same results (a test checks it against the full scan).
- **Fewer, bigger map squares.** The explored map is now 8 m squares (was 4 m) so it stays under a kilobyte, and a player reveals 40 m around them (was 36 m).

**Smoother, and nothing inside the walls.** The cliff faces are wider (about 6 m from foot to top rather than 3 m), so the ground mesh, which is drawn every 2.5 m, can follow them without jagged steps. A walker is stopped a body's width plus a little more before a cliff face, so shoulders no longer sink into the rock. Trees and rocks are not set on steep ground, so none are half buried in a slope.

Resets for existing worlds: because the world is larger, trees are numbered in a different order, so any tree already chopped down in a saved world is forgotten, and everybody's explored map starts again.

## What step 2 built

- **A stream from the mountain to the lake** (`packages/shared/src/world/stream.ts`): about 400 m long, starting at a spring high on the mountain's east side, winding north past the home clearing and into the lake's west shore. Like the lake it is hand-placed (a few waypoints smoothed into a gentle meander), so it is the same in every world.
- **Five small waterfalls**, each a drop of about 2 m, mostly on the steep upper part. The bed only ever goes down. Between falls the water is shallow (knee deep at most, and shallower in the narrow upper part), so players can wade it. It is about 3 m wide near the spring and about 9 m wide at the lake.
- **The ground is shaped round it** by the same seeded rules the hills use, so nothing is sent over the wire: a bowl for the water, a soft bank, and a valley that eases back into the hills. On the mountain the valley cuts a gorge into the slope. Below each fall the bank stays high for a while, making a small ravine you walk around rather than a cliff. Banks are gentle enough to walk (a test follows the whole bank from the lake to the spring).
- **Trees, rocks, grass, buildings and spawns keep clear of the water.** Players are not blocked by it: there are no walls, you simply wade. No fishing or swimming for now.
- **Looks:** a ribbon of water with ripples that run downstream, white foam at the falls and edges, pebbles under the water, a damp lush bank, and stones in the shallows. It is drawn as a flat colour on the map. Placeholder art; the real look comes in a Blender session.
- **Not changed:** the hills' own height, the lake's shape, and where the woodland encounter sites stand. (Trees near the stream's path are simply left out, which does not change any tree's number.)

## What step 3 built

- Two new things to gather: **stone** and **iron ore**. They lie in piles on the mountain, picked up by hand like sticks and berries (Chris chose this over chopping rocks or a pickaxe). Stone is scattered over the lower slopes; ore lies higher, in the bare rock above the pines, so it takes a climb. 16 stone piles and 10 ore piles, placed from the seed (`packages/shared/src/world/mountain-rocks.ts`), on ground that can be walked, away from the stream and trees.
- A picked-clean pile comes back a little way from where it lay, like the forest's berries.
- The **shovel** is crafted by hand from 2 sticks and 3 stone (Chris's choice: sticks and stone). Digging with it came in step 4.
- All placeholder shapes: grey lumps for stone, rust-red lumps with a bright fleck for ore. Art comes in step 5.

## What step 4 built

- **Digging with the shovel.** Hold the shovel and click: you carve a slab of ground in front of you (2 m long, 3 m wide, 4 m tall), so repeated clicks make a tunnel you can walk into. Hold the click (charged swing) to dig down instead, which makes a stairway-sized pit. Each dig costs the same energy as any swing.
- **What you get:** stone and clay from the ground, iron ore deeper in the mountain, and sometimes buried items (`packages/shared/src/sim/digging.ts`, `digYield`). If your pack is full the dig is refused.
- **Where you can't:** not in the home clearing, not near water, not near anything built, not deeper than 12 m, and not once a world holds 20,000 dug cubes.
- **How it is stored:** the land above stays a height map; the dug part is a sparse set of 0.5 m cubes, rebuilt by replaying each saved dig (`dug_slabs` table). Digs are permanent and sent to everybody (one message on joining, then one per new dig).
- **Walking:** feet follow the tunnel floor, walls stop you, a roof stops a jump. The server and the browser use the same code (`DugGrid`).
- **Dark underground:** the daylight fades out as the ground above you thickens. A torch lights the way.
- **Looks:** blocky placeholder faces coloured like the ground; the ground surface is hidden over a tunnel mouth. Art comes in step 5.

## What step 5 has built so far (art, in a Blender session)

- **Layers under the ground.** Tunnel and pit walls wear a small texture painted in Blender (`assets/textures/dug-earth-layers.png`, made by `tools/art/dug_earth_layers.py`): dark topsoil for the top half metre, brown earth with roots and embedded stones down to about 3 m, then cracked grey stone, getting darker with depth. A painted texture was chosen over modular pieces because the walls are built from whatever shape the digs make, and one texture fits any shape without seams. It repeats every 4 m sideways; the height is depth below the ground, so layers line up between holes. On the mountain depth counts 1.6 times over, so the stone starts higher. Floors and roofs use flat colours matched to each layer (the strip is a side view and smears on a flat surface). Look at it in the gallery: `?gallery=dug-earth`.
- Planned, not built: players reinforcing tunnels with wood or stone to stop collapses. The bands and flat floors are meant to leave room for supports.

- **A dig is a metre cube now** (Chris's choice: symmetrical, 1 m x 1 m x 1 m), snapped to the whole-metre grid so neighbouring digs tile cleanly. It replaces the 1 m x 1.5 m x 2 m slab. A swing digs the cube ahead at foot level; once that is open, the next swing takes the cube above it for head room, so a tunnel you can walk takes two swings a metre. A charged swing still digs half a metre lower, so ramps down stay walkable. It needs no new input, so nothing changes on the wire except that a dig's direction can now be 4 (cube). A full cube gives one stone (a slab gave three); energy per swing is the same.
- **Old digs keep their shape.** A saved dig whose direction is 0 to 3 is still the old slab, so no existing tunnel changes.
- **Round, smooth walls** come from a kit of three half-metre pieces made in Blender (`assets/terrain/dug-wall-kit.glb`, recipe in `tools/art/dug_wall_kit.py`): a flat wall, a quarter-round edge and a round dome. The code only chooses and turns them (`apps/client/src/scene/dug-walls.ts`): every open half-metre cube of a hole that touches solid ground gets the piece that fits which sides are solid. The fillet radius is a whole cell, so four edge pieces make a tunnel a metre across perfectly round, and a dome closes a dead end. Until the kit has loaded, the old blocks are drawn. Limits: where a tunnel turns a corner, the outside bend keeps a slight crease; the rim of a hole at the ground surface is still the blocky grass edge; the pieces are smooth but not lumpy.
- Look at it in the gallery: `?gallery=dug-earth`.

- **A proper shovel dig** (a one-second clip made in Blender, `digShovel` in `assets/animations/character.glb`, source `assets/animations/shovel-dig.blend`, added with `tools/add-animation.mjs`): ready with the shovel low at the side, lift and plant the blade, put a foot on it, push in leaning forward, lever the scoop up and out to the right (the ground opens here, 0.6 s in), toss it across the body to the left, and back to ready. A click with the shovel in hand is now one slow dig (`DIG_SWING`: lands on tick 12 of 20, feet planted) instead of a step of the fighting combo, and a held button keeps digging. The dig no longer sends a separate "dig" gesture to everybody; the swing itself shows it. The shovel is held by the middle of the shaft (one grip, `SHOVEL_GRIPS`, fitted exactly to the model posed in Blender). A charged swing is unchanged and still uses the strike clip. Look at it in the gallery: `?gallery=moves&demo=dig-swing&strip=6`. Limits: the shovel is longer than the character, so a few poses stretch; the left wrist briefly overlaps the body in some frames.

- **Loot is rare, and a full pack never stops a dig** (Chris's choice): about 3 digs in 100 turn anything up (`DIG_LOOT_CHANCE`), mostly stone, sometimes ore high on the mountain or clay on low ground. A find with no room in the pack is lost and the game says so. Every refused dig now says why (see `DIG_REFUSALS`); the walls of a hole get a soft smoothing pass (`dug-smoothing.ts`) to take the steps out of a ramp. Gallery: `?gallery=dug-ramp`.

- **Digging goes where the cursor points** (Chris's request): while the shovel is out the browser casts the mouse into the world, takes the first wall, floor, roof or patch of ground it touches and the cube behind it (`cubeAtHit`), lights it up (yellow; red if it cannot be dug or is out of reach) and tells the server (`DigTarget`, 8 bytes, on change and about once a second). The server keeps it for 3 seconds and, when the swing lands, checks it is in reach (`DIG_REACH_METERS`, with slack for walking on), allowed and solid before digging exactly that cube. With no target it digs ahead of the feet as before. This replaced the earlier up, head, level and under hints.

- **Skeletons cannot reach you underground:** somebody in a dug hole with ground over their head, or more than 2.5 m down any hole, counts as out of reach the same as being indoors (`DugGrid.isSheltered`): raiders stop seeing, chasing and hitting them, a blow already swung does not land, and no new raid starts while they are down there. A raid already after them waits, then gives up, as it does for a closed door.
