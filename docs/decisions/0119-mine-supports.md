# 0119 Mine supports

## Context

Digging (decision 0114) lets players carve tunnels. Chris wants them to be able to reinforce a tunnel like a mine: wooden support frames inside it, lanterns hung on the posts later, and eventually a reason to do it, which is that long unsupported tunnels cave in.

This is built in three small pull requests:

1. **Mine supports** (this decision): craft and place wooden supports in a tunnel.
2. **Cave-ins** (next): unsupported tunnels collapse.
3. **Hanging lanterns** (after): they attach to the support posts and light the tunnel.

## Decision

- **A support is an item.** "Mine support" costs 3 logs, crafted by hand with no station (`RECIPES.mineSupport`). It stacks to 10 and can be held like a tool.
- **Placing it:** hold one inside a tunnel; the cell under the mouse lights up green where a support can stand and red where not; a click stands one there and uses one up. It is a click, not a swing, so there is no animation yet.
- **Where it can stand** (`checkSupportCell` in `packages/shared/src/world/supports.ts`): a whole-metre cell of tunnel two metres tall, with solid ground under it, solid ground over it and solid ground along both walls. So a tunnel exactly one metre wide, running straight. It does not fit in a wide room, a junction or a tunnel open to the sky. Which way it runs is worked out from the walls, never chosen.
- **Reach:** the same 3 m (plus the same slack for lag) as digging.
- **Not blocking:** the posts sit against the walls, so nothing needs collision. Players walk straight past them.
- **Stored like digs:** a short list of small numbers (cell and axis), saved in the world's own database (`mine_supports`), sent to everyone on joining (`Supports` 0x43) and when one is stood. Placing is one small message (`PlaceSupport` 0x10). The server checks everything again; the browser's preview is only a guide. Capped at 4,000 supports per world.
- **Refusals** reuse the dig refusal message (`notTunnel`, `supportTaken`, `far`, `full`), so the same "can't dig here" style notice appears.
- **Look:** blocky placeholder frames (two posts, a beam, two corner braces) drawn with three shared instanced meshes. See them in the gallery at `?gallery=mine-supports`. Art replaces them in a Blender session once the mechanic is fun.

## Settled with Chris for the next pull requests

- **Cave-in trigger:** a roofed stretch of tunnel more than about 4 m from the nearest support is at risk. Short digs are safe.
- **Cave-in result:** a warning rumble and dust first, then the roof drops and fills that stretch with earth. Anyone caught inside takes a hit, but there is no knockout and no item loss, and they can dig out.
- **Lanterns:** attach to the posts, so the support frame carries hook points for them.

## Consequences

- Supports do nothing yet beyond looking right, until cave-ins land in the next pull request.
- A support cannot be picked back up yet.
- A tunnel that is later dug out around a support leaves it standing in the air. Cave-ins will need to decide what happens to such supports.
