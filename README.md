# Acorn & Ash

A cozy, third-person survival game that runs in the browser. You live in a
stylized low-poly forest: gather, hunt, fish, fend off creatures, and build a
cabin you can upgrade and decorate.

The game is online-only. Every world runs on the server.

> **Phase 0 — Foundation.** Right now there is a flat test clearing with
> placeholder trees and rocks, a capsule you walk, sprint and jump around, a
> third-person camera, and a server that decides where everybody is. See
> [the roadmap](#roadmap).

## Controls

| Key                               | Does                |
| --------------------------------- | ------------------- |
| `W` `A` `S` `D` or the arrow keys | Walk                |
| `Shift` (held)                    | Sprint              |
| `Space`                           | Jump                |
| Mouse                             | Look around         |
| `Esc`                             | Let go of the mouse |

There is nothing to land on yet, so a jump is a hop in place. Standing on things
comes with the cabin in Phase 3.

## Running it locally

You need [Node.js 24](https://nodejs.org) and [pnpm](https://pnpm.io).

```bash
pnpm install   # once
pnpm dev:web   # the whole game, on http://localhost:8787
```

`pnpm dev:web` runs it the way it is deployed: the game client served by the
Worker, talking to a real World Durable Object. **Open it in two tabs to see two
players.**

`pnpm dev` starts just the client, on http://localhost:5173, with hot reloading.
If it cannot reach a server it builds the clearing anyway and lets you walk about
offline, which is fine for working on how things look.

To play against the deployed staging world:

```bash
VITE_GAME_SERVER_URL=https://acorn-ash-web-staging.workers.dev pnpm dev
```

### Handy switches

Add these to the end of the URL:

| Switch             | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `?renderer=webgl2` | Force the WebGL 2 fallback, even where WebGPU works |
| `?world=some-name` | Join a different world                              |

## Commands

Run these from the repository root.

| Command             | What it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `pnpm dev`          | Start the game client with hot reloading                   |
| `pnpm dev:server`   | Start the world server locally                             |
| `pnpm dev:web`      | Start the Worker that serves the client and the API        |
| `pnpm check`        | Everything the pull request check runs, in one go          |
| `pnpm typecheck`    | Check types in every package                               |
| `pnpm lint`         | Lint everything                                            |
| `pnpm test`         | Run every test                                             |
| `pnpm test:e2e`     | Play the game in a real browser (Playwright smoke tests)   |
| `pnpm build`        | Build everything for deployment                            |
| `pnpm check:assets` | Check every asset has a licence row                        |
| `pnpm bench:tick`   | Measure server tick time and memory with simulated players |
| `pnpm loadtest`     | Point a crowd of bots at a running world                   |

## Repository layout

```
apps/client/        The game itself: Three.js, built with Vite
apps/web/           Worker that serves the client and the API
apps/game-server/   Worker that runs the World Durable Object
packages/shared/    Game rules both sides have to agree on
assets/             Art source files and LICENSES.csv
tools/              Asset scripts, load-test bots, benchmarks
docs/decisions/     Short notes on why things are the way they are
```

### Why two Workers

Cloudflare does not generate preview URLs for a Worker that implements a Durable
Object. Keeping the `World` Durable Object in `game-server` lets `apps/web` get a
preview link for every pull request. Previews connect to the **staging** world.
See [decision 0001](docs/decisions/0001-two-workers-for-preview-urls.md).

## How the game is wired together

1. You press a key. The client moves you straight away, so it feels instant.
2. The client sends what you pressed to the server, 15 times a second.
3. The server simulates everyone 20 times a second and decides where everybody
   really is.
4. The server sends everyone's positions back 10 times a second. Other players
   are drawn a tenth of a second in the past so they glide instead of jumping.
5. If the server disagrees with where the client thought you were, the client
   quietly corrects itself.

The rules in step 1 and step 3 are the same code, in `packages/shared`. That is
why they agree.

## Environments

| Environment  | What it is                     | How it is deployed                |
| ------------ | ------------------------------ | --------------------------------- |
| `local`      | `wrangler dev` on your machine | —                                 |
| `staging`    | Where `main` lives             | Automatically, on merge to `main` |
| `production` | The public game                | Automatically, on a `v*` tag      |

Each environment has its own D1 database, R2 bucket and Durable Object namespace.

Pull requests get their own preview build of `apps/web`, linked in a comment on
the pull request. Previews talk to the **staging** world server.

## Assets and licensing

Every file under `assets/`, and anything served from R2, needs a row in
[`assets/LICENSES.csv`](assets/LICENSES.csv). The pull request check fails
without one, and the in-game credits page is generated from that file. See
[`assets/README.md`](assets/README.md) for the rules about where art may come
from.

**This repository is public.** Never commit secrets, `.env` files, or art whose
licence forbids redistribution.

## Where things are written down

- [`docs/decisions/`](docs/decisions/) — why things are the way they are, one
  short page each.
- [`docs/phase-0-experiments.md`](docs/phase-0-experiments.md) — what we found
  out about WebGPU, running an ECS inside a Durable Object, and what 50 players
  costs.

## Roadmap

| Phase             | Goal                                                                      | Done when                                                                      |
| ----------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **P0 Foundation** | Monorepo, CI/CD, test clearing, a capsule with WASD, World Durable Object | Merging to `main` deploys to staging, and two browser tabs see each other move |
| P1 First steps    | Explore and gather                                                        | Chop a tree, log out, come back, and the stump is still there                  |
| P2 Survive        | Craft, eat, fish, hunt                                                    | A 30-minute session feels good                                                 |
| P3 Home           | Build and decorate a cabin                                                | The cabin looks the same the next day                                          |
| P4 Danger         | Combat, creatures, knockout and buried items                              | Nights feel tense but fair                                                     |
| P5 Together       | Multiplayer at scale                                                      | 50 bots plus 10 people in one world stay smooth                                |
| P6 Launch         | Polish and public release                                                 | Live and linked from itch.io                                                   |
