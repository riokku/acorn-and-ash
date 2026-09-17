# 0001. Two Workers, so every pull request gets a preview link

**Status:** accepted · **Date:** 2026-09-17

## Context

Chris reviews changes by playing them, not by reading code, so every pull
request needs a link he can open in a browser.

Cloudflare does not generate preview URLs for a Worker that implements a Durable
Object. If the game server and the website were one Worker, there would be no
preview link at all.

## Decision

Split the backend in two.

- `apps/game-server` implements the `World` Durable Object: the simulation and
  the realtime WebSockets. It is deployed by hand to staging and production, and
  never previewed.
- `apps/web` serves the game client and the API. It reaches the `World` class
  through a Durable Object binding with `script_name` pointing at the game
  server, which means it does not implement the class itself and so it does get
  preview URLs.

Preview builds of `apps/web` point at the **staging** game server. A preview is
therefore a real, playable build of the client against a shared world.

## Consequences

- Every pull request gets a working link. This is the whole point.
- Two Workers must be deployed in order: the game server first, because
  `apps/web` binds to a script that has to already exist.
- Two people opening two different preview links land in the same staging world.
  That is good for playtesting together and something to remember when a preview
  looks busier than expected.
- Client changes are previewable; server changes are not, and have to reach
  staging before they can be played.
