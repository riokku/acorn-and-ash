# Art session: digging (Blender)

Paste the "Start prompt" below into a new Claude Code chat opened on Chris's computer, in the `acorn-and-ash` folder, with Blender open and the Blender MCP connected. Cloud chats can't reach Blender.

## Before you start (Chris, about 3 minutes)

1. Open Blender and start its MCP server (the Blender MCP add-on panel, "Connect").
2. Open a terminal in the `acorn-and-ash` folder and run `claude`. In that chat, type `/mcp` and check Blender is listed as connected. If not, say so and ask Claude to help.
3. Make sure you have pulled the latest `claude/kind-fermi-cfhwrc` branch (or main once the digging PR is merged). Claude will do this if you ask.
4. Don't paste Sketchfab or Hyper3D keys anywhere in the chat; they stay in Blender's add-on settings.

## Start prompt

> Read `CLAUDE.md` (especially "Making art with Blender") and `docs/decisions/0114-mountain-stream-and-digging.md`. First check that you can see my live Blender scene; if you can't, stop and tell me.
>
> Today's art session is three small jobs for digging. One pull request per job, in this order. Show me screenshots as you go and wait for my OK before each export.
>
> **Job 1: depth under the map.** When someone digs, they see emptiness below the ground. The world should look solid underneath: ground that has layers (topsoil, then earth, then stone further down), with a few embedded stones or roots and a slightly darker colour the deeper it goes. Decide with me whether this is a small tileable painted texture or a few modular "rubble" pieces. Remember tunnel walls are drawn in code (`apps/client/src/scene/digging.ts`), so a texture is the likelier route.
>
> **Job 2: round holes.** Today a dig is built from half-metre blocks (`apps/client/src/scene/digging.ts`), so holes look square and blocky inside. I want holes that look round and natural, smooth earthy walls without block steps. Each dig should be small. Ask me before you change how big a dig is; that is a game rule in `packages/shared/src/world/digging.ts`, not just art. Tell me plainly what code would have to change to show Blender-made hole shapes, and propose the smallest way. Don't fake it with shapes drawn in code.
>
> **Job 3: a shovel dig animation.** The shovel currently reuses the axe swing, which looks wrong. Make a proper dig for the character: plant the shovel, push it in with a foot, lever up a scoop, toss it aside, then back to idle. Start from the existing character rig in `assets/animations/character.glb` and look at how the existing clips are wired in `apps/client/src/scene/character-moves.ts`. Keep the rig and bone names unchanged. Keep it about one second.
>
> Follow every rule in CLAUDE.md: look at it from several angles before calling it done, keep inside the triangle limits, save `.blend` files under `assets/`, compress with `node tools/import-model.mjs`, add `LICENSES.csv` rows for every file, and open each pull request with before and after screenshots and a "How to test" that includes the gallery link (`<preview link>/?gallery=<name>`). Keep the placeholder shapes in place if anything can't be done with Blender.

## Notes for Claude (the local one)

- Python run in Blender runs on Chris's computer: only build or edit the scene, or export into this repo's `assets/` folder.
- The ground mesh is one smooth plane with 2.5 m cells. The code hides ground cells over a hole and builds the area from blocks (`createDigScene`). Round holes will most likely mean replacing those blocks with a smoother mesh; raise this with Chris before coding.
- The current dig clip is `dig` in `apps/client/src/scene/character-moves.ts` (`Gesture.Dig`, 1.4 s, whole body), shown on the gallery at `?gallery` under moves. The swing a shovel click currently plays comes from the axe's swing; check how a held shovel picks its swing before animating.
- Walking in and out of tunnels follows the same block rules the server uses (`packages/shared/src/world/digging.ts`). Visual changes must not change where the player can walk unless Chris agrees.
