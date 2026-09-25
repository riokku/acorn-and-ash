# Acorn & Ash

A cozy, third-person survival game that runs in the browser. You live in a
stylized low-poly forest: gather, hunt, fish, fend off creatures, and build a
cabin you can upgrade and decorate.

The game is online-only. Every world runs on the server.

> **Phase 4 — Danger.** Right now there is a hand-built home clearing with
> real birch, oak and pine trees, real rocks and a pond,
> surrounded by generated wilderness you can walk out into, a real animated
> character you walk, sprint and jump around, a
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
> at home, or the clearing, having buried half of what you were carrying
> right where you went down - your axe and rod always stay with you - so
> it's worth walking back for. Or fight it off first, with the same axe, and
> it runs off empty-handed. A quick dodge can get you through its swing
> untouched, timed right, and holding right click winds up a heavy swing of
> your own that finishes a tree or a fight outright - if you can afford to
> stand still long enough for it. A day passes every twenty minutes, the sky
> brightening and dimming the same way for everyone in the world at once -
> nothing plays differently by night yet, but it's there to watch. Chopping,
> landing a hit and taking one all have a bit of weight to them now - a small
> camera kick and a sound - and a calm tune plays once you're in. The
> campfire has real art now, and you can light it - press `E` next to one -
> for a genuinely animated fire that flickers for a while and either burns
> down on its own or goes out early if you put it out by hand. The axe and
> fishing rod are real modeled art now too. A fox roams the wilderness
> alongside the rabbits and the raccoon - it flees you exactly like a
> rabbit, but sometimes hunts one down itself, and you can catch it the
> same way you catch any other prey. Every player now walks, runs and jumps
> as a real animated character - Knight, standing in for everyone until a
> picker menu exists to choose between the pack's six. See
> [the roadmap](#roadmap).

## Controls

| Key                               | Does                                                           |
| --------------------------------- | -------------------------------------------------------------- |
| `W` `A` `S` `D` or the arrow keys | Walk                                                           |
| `Shift` (held)                    | Sprint                                                         |
| `Space`                           | Jump                                                           |
| `E`                               | Pick up, gather, dig up a cache, light/put out a campfire, eat |
| `1` / `2`                         | Craft an axe / fishing rod                                     |
| `B`                               | Open the build menu                                            |
| `1`–`4` (menu open)               | Build a campfire, cabin, flower bed or lantern                 |
| Left mouse                        | Chop, cast, hook, fight off                                    |
| Right mouse (held)                | Charge a heavy attack                                          |
| Left `Ctrl`                       | Dodge                                                          |
| Mouse                             | Look around                                                    |
| `Esc`                             | Let go of the mouse                                            |

There is nothing to land on yet, so a jump is a hop in place.

You can carry one axe, one fishing rod, ten logs, ten sticks, ten flowers, ten
meat and ten of each kind of fish. The limits, and how much hunger eating one
restores, live in
[`packages/shared/src/data/items.ts`](packages/shared/src/data/items.ts), what
each tree costs in swings and pays in logs lives in
[`packages/shared/src/data/props.ts`](packages/shared/src/data/props.ts), and
which fish bite and how often lives in
[`packages/shared/src/data/fish.ts`](packages/shared/src/data/fish.ts).

### Your character

Every player is drawn as Knight, one of six characters from a free pack,
walking, running and jumping for real rather than sliding around as a
placeholder capsule. There's no way to choose a different one yet - that's
its own future piece of work - so everybody looks like the same tinted
Knight for now.

Carrying an axe now actually shows it in your hand, not just as a line in
the side panel - it's parented straight onto the character's own hand, so
it moves with the arm through every animation, held at a natural, mostly
upright angle. Landing a chop swings it at the tree. Only your own axe
shows this way for now, since the server has never told you what anyone
else is carrying. See
[decision 0036](docs/decisions/0036-a-real-moving-character.md).

### The wilderness

Past the clearing's own ring of trees the ground rolls into hills, and the
forest thickens the further out you go, out to a wall 150 m from the centre.
It's generated from the world's seed, so the server and every browser draw
the same hills and the same trees without anything about them going over the
wire - the same trick the clearing itself already uses. Nothing out there can
be chopped or picked up yet; it's somewhere to walk, for now. See
[decision 0015](docs/decisions/0015-wilderness-beyond-the-clearing.md).

### Day and night

A 20-minute day runs the whole time a world is awake, the sky and light
brightening and dimming smoothly between noon and midnight. It's the
server's own clock, so it never skips and it's the same moment for everyone
in the world; the HUD's "Time" row says which half you're in right now.
Nothing about how the game plays changes with it yet - that's deliberately
saved for later. See
[decision 0027](docs/decisions/0027-a-day-and-night-cycle.md).

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

A fox lives out there too, with real modeled art rather than a placeholder
shape. To you, it is just another rabbit: it flees the moment you get close
and pays out meat the same way if you catch it. Left alone, though, it
roams wider than a rabbit does and sometimes chases one down itself - if it
catches one, that rabbit is gone until it respawns at its den, same as if
you had caught it yourself. A fox spooked by you mid-chase drops the hunt
and flees like any other prey. See
[decision 0035](docs/decisions/0035-a-fox-that-hunts-rabbits.md).

### Danger

A masked raccoon lives out there too, at its own fixed dens same as a
rabbit. Left alone it ambles about the same way - but get too close and,
unlike a rabbit, it does not run: it comes straight for you. Once it
catches up it stops and plants its feet for a moment before it swings; back
out of reach before that moment ends and it misses. Land three hits of your
own first, with the same axe, and it runs off with nothing to show for it.

Getting hit costs health, a new meter alongside hunger. Run it out and
you're knocked out - you wake up safe at home, if you have a cabin, or the
shared clearing otherwise, healed straight back up. See
[decision 0024](docs/decisions/0024-a-masked-raccoon-that-fights-back.md).

A knockout buries half of what you were carrying - your axe and rod always
stay with you - right where you went down, and heals you fully same as
before. A small mound marks the spot; walk back to it and the HUD offers to
dig it up, the same as reaching for anything else on the ground. Nobody but
you can dig up your own cache. See
[decision 0028](docs/decisions/0028-buried-items-after-a-knockout.md).

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
  stump pays out. Real modeled art, and you can light it: press `E` once
  you're standing next to it for a genuinely animated fire, atmosphere only
  for now. It burns for a while and goes out on its own, or put it out early
  by pressing `E` again.
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
ownership and the spawn-at-home rule,
[decision 0023](docs/decisions/0023-decorating-the-garden.md) for the flower
bed, the lantern and the per-kind build cap, and
[decision 0033](docs/decisions/0033-a-campfire-you-can-light.md) for the
campfire's real art, its animated fire and lighting it.

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

A Cloudflare Worker can pick up a Git connection made in the Cloudflare web UI,
completely separate from the deploy pipeline in this repository. When that
happens, Cloudflare tries to build and deploy that Worker itself on every
commit, using settings that don't match how this monorepo is actually built,
and it fails every time, including on `main`. This has shown up twice: once as
a stray Worker named after the whole repository with nothing in the code to
match it, and once as a direct connection on `acorn-ash-game-server-production`
and `acorn-ash-web-production` themselves (found and disconnected 2026-09-24).

The tell, in the Cloudflare dashboard's **Workers & Pages** list: a Worker
deployed only through our GitHub Actions workflows just shows "View
deployments," with no commit message. One with a stray Git connection shows a
GitHub badge and a commit message instead — that's the one to check.

To stop it: Cloudflare dashboard → **Workers & Pages** → that Worker →
**Settings** → **Build** → disconnect the Git repository. Our own deploys
never use this feature, so disconnecting it is always safe and never affects
the game.

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
