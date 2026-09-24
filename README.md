# Acorn & Ash

A cozy, third-person survival game that runs in the browser. You live in a
stylized low-poly forest: gather, hunt, fish, fend off creatures, and build a
cabin you can upgrade and decorate.

The game is online-only. Every world runs on the server.

> **Phase 4 — Danger.** Right now there is a hand-built home clearing with
> placeholder trees, rocks and a pond, surrounded by generated wilderness you
> can walk out into, a capsule you walk, sprint and jump around, a
> third-person camera, and a server that decides where everybody is. Find the
> axe standing in a stump and chop trees down; they grow back while you are
> away. Find the rod on the bank of the pond and catch fish. Gather sticks by
> hand and craft your own axe or rod instead. You get hungry the longer you
> play, and eating a fish tops you back up. Rabbits live out in the
> wilderness - walk up on one and it bolts, but catch it with the same axe
> that fells a tree and it pays out meat, worth even more than a fish. Chop
> enough logs and you can build a campfire, or a cabin of your own - once you
> have one, that is where you start next time, instead of the open clearing.
> Gather flowers the same way as sticks and plant a flower bed or a lantern
> to decorate the place. A masked raccoon lives out there too, and it is not
> shy - it comes after you, and enough hits knock you out. You wake up safe
> at home, or the clearing, with nothing lost but the walk back - or fight it
> off first, with the same axe, and it runs off empty-handed. A quick dodge
> can get you through its swing untouched, timed right, and holding right
> click winds up a heavy swing of your own that finishes a tree or a fight
> outright - if you can afford to stand still long enough for it. See
> [the roadmap](#roadmap).

## Controls

| Key                               | Does                                           |
| --------------------------------- | ---------------------------------------------- |
| `W` `A` `S` `D` or the arrow keys | Walk                                           |
| `Shift` (held)                    | Sprint                                         |
| `Space`                           | Jump                                           |
| `E`                               | Pick up, gather, eat                           |
| `1` / `2`                         | Craft an axe / fishing rod                     |
| `B`                               | Open the build menu                            |
| `1`–`4` (menu open)               | Build a campfire, cabin, flower bed or lantern |
| Left mouse                        | Chop, cast, hook, fight off                    |
| Right mouse (held)                | Charge a heavy attack                          |
| Left `Ctrl`                       | Dodge                                          |
| Mouse                             | Look around                                    |
| `Esc`                             | Let go of the mouse                            |

There is nothing to land on yet, so a jump is a hop in place.

You can carry one axe, one fishing rod, ten logs, ten sticks, ten flowers, ten
meat and ten of each kind of fish. The limits, and how much hunger eating one
restores, live in
[`packages/shared/src/data/items.ts`](packages/shared/src/data/items.ts), what
each tree costs in swings and pays in logs lives in
[`packages/shared/src/data/props.ts`](packages/shared/src/data/props.ts), and
which fish bite and how often lives in
[`packages/shared/src/data/fish.ts`](packages/shared/src/data/fish.ts).

### The wilderness

Past the clearing's own ring of trees the ground rolls into hills, and the
forest thickens the further out you go, out to a wall 150 m from the centre.
It's generated from the world's seed, so the server and every browser draw
the same hills and the same trees without anything about them going over the
wire - the same trick the clearing itself already uses. Nothing out there can
be chopped or picked up yet; it's somewhere to walk, for now. See
[decision 0015](docs/decisions/0015-wilderness-beyond-the-clearing.md).

### Wildlife

A few rabbits (a placeholder box with two ears, for now) live at fixed spots
out in the wilderness. Left alone they amble about near home; get too close
and one bolts, curving away for as long as you keep following. See
[decision 0018](docs/decisions/0018-a-rabbit-that-flees.md).

Catch one with the same swing that fells a tree - an axe, and a rabbit within
reach of it - and it pays out meat, which restores more hunger than a fish
since a catch takes an actual chase. A caught rabbit is back at its den,
ready to catch again, a minute later. See
[decision 0019](docs/decisions/0019-catching-wildlife.md).

### Danger

A masked raccoon lives out there too, at its own fixed dens same as a
rabbit. Left alone it ambles about the same way - but get too close and,
unlike a rabbit, it does not run: it comes straight for you. Once it
catches up it stops and plants its feet for a moment before it swings; back
out of reach before that moment ends and it misses. Land three hits of your
own first, with the same axe, and it runs off with nothing to show for it.

Getting hit costs health, a new meter alongside hunger. Run it out and
you're knocked out - you wake up safe at home, if you have a cabin, or the
shared clearing otherwise, healed straight back up. Nothing else is lost
yet; the only cost right now is the walk back. See
[decision 0024](docs/decisions/0024-a-masked-raccoon-that-fights-back.md).

Left `Ctrl` dodges - a quick, decisive step in whatever direction you are
holding, or straight back if you are holding nothing - and leaves you
briefly untouchable, so timed right it gets you through a swing rather than
only away from it. It needs a moment to recharge before it is ready again.
See [decision 0025](docs/decisions/0025-a-dodge-that-buys-you-a-moment.md).

Holding right click winds up a charged attack - about a second, rooted to
the spot the whole time, the same as the raccoon's own wind-up asks of it.
Whatever it lands on when it goes off is finished outright: a tree falls in
one regardless of how many ordinary swings it would otherwise take, and a
raccoon is beaten in one regardless of how many hits it has left. It is a
real trade - you cannot move, dodge or block while charging - so it suits a
decisive moment more than a running fight. See
[decision 0026](docs/decisions/0026-a-charged-attack-that-finishes-the-job.md).

### Fishing

The rod lies on the bank of the pond. Face the water and left click to cast. The
float bobs while fish nibble; when it goes right under, click. Too soon or too
slow and the fish gets away. Three kinds bite: perch, trout, and now and then a
golden carp.

You have a second to click from the moment the float goes under on your own
screen, however slow your connection. The server times it on your side of the
wire, from a flag your browser sets on everything it sends while it is showing
the bite. See [decision 0014](docs/decisions/0014-fishing.md).

### Crafting

Sticks are gathered by hand - no tool needed - from a couple of patches of
fallen branches in the clearing. Press `E` next to one, the same as picking
something up off the ground. A patch never runs out, so it does not matter if
somebody else already grabbed the world's one axe or rod: you can still get
your own. Flower patches work exactly the same way; what flowers are for
lives in [Building](#building) below.

Press `1` to make an axe out of three sticks, or `2` to make a fishing rod out
of two logs. The side panel lists both recipes and lights one up once your
pack can afford it. Finding the axe in the stump and the rod on the bank still
work exactly as before; crafting is another way to get one. See
[decision 0017](docs/decisions/0017-crafting.md).

### Hunger

You get hungrier the longer you play. Press `E` and, if there is nothing at
your feet to pick up, you will eat a fish out of your pack instead, common
ones first. Running out is a nudge, not a penalty: the HUD says so and the
hint turns urgent, but nothing worse happens yet. See
[decision 0016](docs/decisions/0016-hunger-and-eating.md).

A full meter takes twenty minutes to run out for real. `local` runs and
preview links use three minutes instead, set by `WORLD_HUNGER_EMPTY_SECONDS`
in [`apps/game-server/wrangler.jsonc`](apps/game-server/wrangler.jsonc), the
same way tree regrowth is turned down. Staging and production use the real
wait.

### Trees growing back

A felled tree comes back on its own, somewhere between half an hour and an hour
later, at a size of its own. It counts in real time rather than in ticks, so a
tree felled before bed is standing again by morning even though the world was
asleep the whole time. A tree will not grow back through somebody standing on
the spot; it waits until they move. See
[decision 0013](docs/decisions/0013-trees-growing-back.md).

Half an hour is a long time to wait while working on it, so `local` runs and
preview links use two minutes instead, set by `WORLD_REGROW_SECONDS` in
[`apps/game-server/wrangler.jsonc`](apps/game-server/wrangler.jsonc). Staging and
production use the real wait.

### Building

Press `B` to open a small menu of what you can place just in front of you,
anywhere in the clearing, then a number to pick one:

- **Campfire** - four logs, exactly what felling the landmark oak by the axe
  stump pays out. A placeholder pile of logs, for now, that does nothing yet
  beyond standing there.
- **Cabin** - ten logs, the most a pack can ever hold at once. Capped at one
  per player: once you have built yours, that is where you start next time,
  instead of the open clearing. A placeholder box with a peaked roof for now
  - walked around, not into yet.
- **Flower bed** - six flowers, gathered by hand from a patch the same way
  as sticks. Capped at one per player.
- **Lantern** - four flowers. Also capped at one per player, independently
  of the flower bed - owning one never blocks the other.

The hint at the bottom tells you when the spot you're facing is clear and
your pack can afford whatever you have picked. What each one costs lives in
[`packages/shared/src/data/buildables.ts`](packages/shared/src/data/buildables.ts).
See [decision 0020](docs/decisions/0020-a-campfire-you-can-build.md) for the
campfire and placement itself,
[decision 0022](docs/decisions/0022-a-cabin-of-your-own.md) for the cabin,
ownership and the spawn-at-home rule, and
[decision 0023](docs/decisions/0023-decorating-the-garden.md) for the flower
bed, the lantern and the per-kind build cap.

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
VITE_GAME_SERVER_URL=https://acorn-ash-web-staging.chrisistinson.workers.dev pnpm dev
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
| `pnpm check`        | Typecheck, lint, test, asset licences and build, in one go |
| `pnpm format:check` | Check formatting - the one thing `pnpm check` leaves out   |
| `pnpm typecheck`    | Check types in every package                               |
| `pnpm lint`         | Lint everything                                            |
| `pnpm test`         | Run every test                                             |
| `pnpm test:e2e`     | Play the game in a real browser (Playwright smoke tests)   |
| `pnpm build`        | Build everything for deployment                            |
| `pnpm check:assets` | Check every asset has a licence row                        |
| `pnpm bench:tick`   | Measure server tick time and memory with simulated players |
| `pnpm loadtest`     | Point a crowd of bots at a running world                   |

The pull request check runs both `pnpm check` **and** `pnpm format:check` as
separate steps - run both before pushing, since passing the first one alone
does not mean the second will too.

`pnpm test:e2e` takes several minutes: one of the tests chops a tree down and
then waits for it to grow back, and another waits at the pond for a bite.

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
preview link for every pull request. See
[decision 0001](docs/decisions/0001-two-workers-for-preview-urls.md).

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

Pull requests get a preview link in a comment on the pull request, and it is the
whole game: that branch's client **and** a world server built from that branch,
deployed as `acorn-ash-game-server-pr-<number>` and removed again when the pull
request closes. So anything in a pull request can be played before it is merged,
including changes to the game rules and the server. Each preview world starts
empty. See [decision 0011](docs/decisions/0011-a-world-server-per-pull-request.md).

### A red check that is not ours

Pull requests show a failing **Workers Builds: acorn-and-ash** check. It is not
from this repository: it is a Cloudflare dashboard Git integration, set up in the
Cloudflare web UI, trying to deploy a Worker named after the repository that does
not exist in the code. It fails on every commit, including on `main`, and there
is nothing here to fix. To stop it: Cloudflare dashboard → **Workers & Pages** →
**acorn-and-ash** → **Settings** → **Build** → disconnect the Git repository.
Our own deploys do not use it.

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

| Phase          | Goal                                                                      | Done when                                                                      |
| -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P0 Foundation  | Monorepo, CI/CD, test clearing, a capsule with WASD, World Durable Object | Merging to `main` deploys to staging, and two browser tabs see each other move |
| P1 First steps | Explore and gather                                                        | Chop a tree, log out, come back, and the stump is still there                  |
| P2 Survive     | Craft, eat, fish, hunt                                                    | A 30-minute session feels good                                                 |
| P3 Home        | Build and decorate a cabin                                                | The cabin looks the same the next day                                          |
| **P4 Danger**  | Combat, creatures, knockout and buried items                              | Nights feel tense but fair                                                     |
| P5 Together    | Multiplayer at scale                                                      | 50 bots plus 10 people in one world stay smooth                                |
| P6 Launch      | Polish and public release                                                 | Live and linked from itch.io                                                   |
