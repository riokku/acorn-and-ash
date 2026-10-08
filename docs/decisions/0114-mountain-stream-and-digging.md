# 0114 · A mountain range, a stream down to the lake, and digging tunnels

**Status:** accepted; step 1 (the mountain terrain) built · **Date:** 2026-10-08

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

Resets for existing worlds: because the world is larger, trees are numbered in a different order, so any tree already chopped down in a saved world is forgotten, and everybody's explored map starts again.

Still to come: the stream and waterfalls (step 2), the shovel and ore (step 3), digging (step 4) and art (step 5).
