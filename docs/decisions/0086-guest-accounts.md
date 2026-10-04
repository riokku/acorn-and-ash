# 0086. Guest accounts, on Cloudflare

**Status:** accepted · **Date:** 2026-10-04

## Context

Until now the game knew a player by a random key kept in the browser. Clear
your browser data, or open the game on another computer, and your character and
your cabin were gone. The key also travelled in the address of every
connection, and the game server believed whatever key it was handed. Chris
wants people to be able to save their progress easily, and to use Cloudflare
for as much of it as possible. Real sign-in (Google and Discord) is the goal;
this is the first step, and the one everything else stands on.

## Decision

**Every browser gets an account the first time it plays, as a guest.** Nothing
to type. The web Worker creates it with Better Auth and keeps it in a D1
database (Drizzle writes the tables). The browser holds only a session cookie,
good for a year and pushed back each visit.

**The browser never holds the key the worlds use.** Each account has one
private key, kept in D1. When a browser connects to a world, the web Worker
reads the cookie, looks the key up, and tells the world which player is
connecting, throwing away anything the browser put in the address. A browser can
no longer claim to be someone else. The worlds themselves did not change at all:
they still save characters under a key, exactly as decision 0057 describes.

**Existing characters carry over.** A browser that played before accounts sends
its old key once, when its guest account is made. A brand-new guest may take
that key if nobody else has it, so nobody starts again. Taken keys, and keys
claimed by an account that is already signed in, are refused.

**Cloudflare does the rest.** New guests are limited per address by Cloudflare's
own rate limiter, and only creating one counts; coming back never does. CI
creates each environment's database and a random session secret itself, using
`tools/prepare-accounts.mjs`, so nobody sets anything up by hand. Staging and
production keep one database each; every pull request preview shares one
throwaway database, with a session secret of its own.

## Consequences

- Progress now survives as long as the cookie does. Signing in with Google or
  Discord, which makes it survive a new computer, is the next change. It will
  need to settle what happens when a guest signs into an account that already
  has a character.
- A guest who clears their cookies is a new player. The old character is still
  in the world but nothing points to it. Signing in is the fix, and the game
  should say so.
- Every connection now costs one D1 read. Fine at this size; a cache is the
  answer if it ever isn't.
- The game server is still reachable by key if someone finds its address. The
  keys are unguessable and never sent to other players, so this is no worse than
  before, but locking the game server to the web Worker is worth doing.
- `VITE_GAME_SERVER_URL` is gone. A login cookie cannot safely follow a page to
  another site, so playing a local client against the staging server no longer
  works. Open the staging link instead.
- The Cloudflare API token needs **D1: Edit** and **Workers Scripts: Edit**
  permission for CI to create databases and secrets.
