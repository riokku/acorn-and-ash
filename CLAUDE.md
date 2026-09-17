# Acorn & Ash

A cozy, third-person survival game that runs in the browser. The player lives in a stylized low-poly forest: they gather, hunt, fish, fend off creatures and build a cabin they can upgrade and decorate. The game is online-only. Every world runs on the server, starting with single-player and growing to 10–50 players per world.

## Working with Chris

- Chris is the game director and playtester and doesn't write code. Explain changes in plain language, without jargon.
- Keep pull requests small and focused on one playable change.
- Every PR description ends with **How to test**: the preview link, then numbered steps Chris can follow in a browser.
- Don't ask Chris to run terminal commands unless nothing else works. If you must, give the exact command and say what it does.
- If a design question comes up that isn't answered below, ask Chris. Don't guess.
- Record major technical decisions in `docs/decisions/NNNN-title.md`: context, decision and consequences, in under a page.

## Design decisions (settled)

| Area | Decision |
| --- | --- |
| Camera | Third-person follow camera that pulls in when blocked |
| Survival | Cozy-light: hunger and energy only |
| Knockout | Player wakes in their bed. Some items are buried somewhere in the world, and the player has to find them. |
| Threats | Creatures first (e.g. goblins, masked raccoons). Bandits and rival settlers come later. No PvP. |
| Combat | Light action: light and charged attacks, dodge, readable enemy wind-ups |
| World | Hand-built home clearing (about 64 × 64 m) surrounded by wilderness generated from a seed |
| Time | 20-minute day. Night never skips in multiplayer. |
| Characters | Tied to one world, never carried between worlds |
| Devices | Desktop keyboard and mouse first. Gamepad later. No mobile at launch. |
| Art | Stylized low-poly that matches Quaternius "Ultimate Stylized Nature" (CC0) |
| Goal | Free to play on the web |

## Tech stack

- **Language:** TypeScript (strict) everywhere. Use pnpm workspaces and Node.js 24 LTS.
- **Client:** Three.js (r186+) with `WebGPURenderer`, which falls back to WebGL 2 automatically. Built with Vite.
- **Game structure:** Koota ECS (pmndrs). Use it in both client and server simulation code.
- **UI:** React for menus and HUD only, drawn as an HTML layer over the canvas. The 3D scene is plain Three.js, not React Three Fiber.
- **Collision:** our own simple kinematic collision in `packages/shared`: terrain height map plus capsules, cylinders and boxes. On the client, `three-mesh-bvh` handles camera collision and raycasts. Rapier is not used for now.
- **Server:** Cloudflare Workers plus Durable Objects (SQLite-backed). Hono handles HTTP routes, and PartyServer or plain Durable Object WebSockets handle realtime.
- **Data:**
  - D1 (via Drizzle) for accounts, profiles and the list of worlds.
  - Each world's own Durable Object SQLite database for world state.
  - R2 for large assets and backups.
- **Auth:** Better Auth on Workers + D1, with Google and Discord login plus guest accounts that can be upgraded. Added in Phase 1.
- **Tests:** Vitest (with `@cloudflare/vitest-pool-workers` for Worker code) and Playwright smoke tests.

## Repo layout

```
apps/client/        Three.js game (Vite). Builds to static files served by apps/web
apps/web/           Worker: serves the client, API routes, login. Binds to the World DO in game-server
apps/game-server/   Worker that implements the World Durable Object (simulation + WebSockets)
packages/shared/    Game rules, collision, ECS traits, data tables, network message formats
assets/             Blender source files + LICENSES.csv
tools/              Asset scripts (glTF Transform), load-test bots
docs/decisions/     Short decision records
```

**Why two Workers:** Cloudflare doesn't generate preview URLs for Workers that implement a Durable Object. Keeping the Durable Object in `game-server` lets `apps/web` get a preview URL for each PR. `apps/web` binds to the World class with `script_name`, and previews connect to the **staging** game server.

## Architecture rules

1. **The server decides.** Clients send inputs (move, swing, place). The server validates each one and owns all results. Never trust client positions, inventory or damage.
2. **Shared simulation.** Game rules live in `packages/shared` as deterministic, framework-free TypeScript: no DOM, no Workers APIs, no `Math.random()` (use a seeded random generator). Client and server import the same code.
3. **Ticks.** The server simulates at 20 Hz and sends snapshots at 10–15 Hz.
   - The local player moves instantly on the client (prediction) and is corrected when the server disagrees (reconciliation).
   - Other players are shown about 100 ms behind (interpolation).
   - Hits are checked with up to about 150 ms of lag compensation.
4. **Interest management.** The world is split into 32 m chunks. Each player only receives entities within about 100 m.
5. **Network messages.** Use compact binary encoding. Clients send inputs 10–15 times per second, bundled. Cloudflare bills incoming WebSocket messages at 20:1.
6. **World lifecycle.** A world wakes when the first player connects and runs its tick loop only while players are connected. It saves every 30 s and when the last player leaves. After that, it **clears all timers**, because timers prevent hibernation and cost money.
7. **Durable Object limits.**
   - 128 MB memory per object.
   - 30 s CPU per incoming event.
   - Keep a tick under 10 ms. Log slow ticks.
   - WebAssembly must be imported at build time; Workers can't compile it from bytes at runtime.
8. **Content as data.** Items, recipes, animals and build pieces live in typed data tables in `packages/shared/data`, not in scattered code.
9. **Units.** 1 unit = 1 meter, Y is up, time is in seconds.

## Cloudflare notes

- The free plan only supports **SQLite-backed** Durable Objects. Configure new classes that way, following the current Wrangler docs.
- Static assets are limited to 25 MiB per file. Put large models and textures in R2 with content-hashed names.
- Environments: `local` (`wrangler dev`), `staging`, `production`. Each has its own D1 database, R2 bucket and Durable Object namespace.

## CI/CD (GitHub Actions)

- Deploys use `cloudflare/wrangler-action@v3`. Repo secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- **Pull request:** install, typecheck, lint, test, build, asset-license check. Then upload a preview version of `apps/web` with alias `pr-<number>` and comment the link on the PR.
- **Push to `main`:** deploy `game-server` and `web` to staging.
- **Tag `v*`:** deploy both to production.

## Assets & licensing

- Every file under `assets/` or served from R2 needs a row in `assets/LICENSES.csv`: `file, source_url, author, license, date_added, modifications, ai_tool, ai_plan`. CI fails when an asset has no row. The in-game credits page is generated from this file.
- Allowed sources:
  - CC0 packs (Quaternius, KayKit, Kenney).
  - Meshy, on a paid plan or on the free plan with CC BY 4.0 credit.
  - Tripo, on a paid plan only.
- Not allowed: Hunyuan3D, or anything with unclear terms.
- Size limits: player 10k triangles, animals 5k, trees 4k (with distance versions), props 2k. Optimize with glTF Transform (Meshopt + KTX2).
- **This repo is public.** Never commit secrets, `.env` files, or asset source files whose license forbids redistribution (e.g. paid "Source" tiers).

## Code conventions

- TypeScript `strict`. No `any` without a comment explaining why.
- Keep functions small and name things for what they mean in the game (`chopTree`, not `handleAction3`).
- Write tests for shared rules (collision, inventory, crafting, damage) and for message encoding and decoding.
- Build with placeholder shapes first. Art replaces them only once a mechanic is fun.
- Keep `README.md` current, with how to run locally, commands and the environment layout.

## Roadmap

| Phase | Goal | Done when |
| --- | --- | --- |
| **P0 Foundation (current)** | Monorepo, CI/CD, test clearing, a capsule character with WASD and follow camera, World DO with 20 Hz loop | Merging to main deploys to staging, and two browser tabs see each other move |
| P1 First steps | Explore and gather | Chop a tree, log out, come back, and the stump is still there |
| P2 Survive | Craft, eat, fish, hunt | A 30-minute session feels good |
| P3 Home | Build and decorate a cabin | The cabin looks the same the next day |
| P4 Danger | Combat, creatures, knockout and buried items | Nights feel tense but fair |
| P5 Together | Multiplayer at scale | 50 bots plus 10 people in one world stay smooth |
| P6 Launch | Polish and public release | Live and linked from itch.io |

Phase 0 experiments to report on:

- WebGPU fallback in Chrome, Firefox and Safari.
- Koota running inside a Durable Object.
- Tick time and memory with 50 simulated players.
