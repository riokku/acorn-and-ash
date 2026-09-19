# 0011. A world server per pull request

**Status:** accepted · **Date:** 2026-09-19

## Context

A pull request preview used to be that branch's game client wired to the
**staging** world server, which runs whatever is on `main`. That is fine for a
change to how something looks, and useless for anything else.

It bit us twice in a row. The jump and sprint pull request came with test steps
that could not have worked: staging did not know about jumping, so the server
kept pulling the player back down. The axe pull request was worse — the axe and
the prompt were drawn, because the client draws them, but pressing E did nothing
at all, because nothing on `main` reads the interact button or knows the
inventory messages exist.

Both were merged on trust and played afterwards. Chris asked for previews he can
actually play, and from Phase 1 onwards nearly every change touches the shared
rules or the server, so this was only going to get worse.

## Decision

Each pull request gets its own world server.

The preview job deploys `apps/game-server` from the branch as
`acorn-ash-game-server-pr-<number>`, using a `preview` environment that exists
only to be renamed on the command line. It then writes a copy of
`apps/web/wrangler.jsonc` with the Durable Object binding pointed at that server,
and uploads the preview version of the web Worker with it.

Only the uploaded version carries the different binding. The deployed staging
Worker is untouched and still talks to the staging world.

A second workflow removes the server when the pull request closes, merged or
not, after asking the Cloudflare API whether there is one to remove.

## Consequences

- A preview link is the whole game. Anything in a pull request can be played
  before it is merged, which is the point.
- Each preview world is brand new: its Durable Objects start empty, so the axe
  is back in its stump and nothing gathered on staging carries over. That is
  usually what you want from a test world, and it does mean a preview cannot
  show you "what happens to a world that already exists".
- An open pull request holds a Worker and a Durable Object namespace until it is
  closed. A handful at a time is nothing; a hundred stale branches would not be.
- Two couplings are now guarded with `grep` in the workflow rather than left to
  chance: the staging Worker's name, and the name of the binding being rewritten.
  Rename either and the job fails loudly instead of quietly previewing against
  staging again.
- Forks still get no preview, because they cannot see the repository secrets.
  That was already true.
