# 0086. Sign in with Google or Discord, on Cloudflare

**Status:** accepted · **Date:** 2026-10-04

## Context

Until now the game knew a player by a random key kept in the browser. Clear your
browser data, or open the game on another computer, and your character and your
cabin were gone. The key also travelled in the address of every connection, and
the game server believed whatever key it was handed. Chris wants people to save
their progress easily, to have to make a real account to play, and to use
Cloudflare for as much of it as possible. Guest accounts were tried first and
dropped: a guest is only a cookie with a different name, and loses everything
the same way.

## Decision

**Playing needs a Google or Discord account.** The web Worker signs people in
with Better Auth and keeps accounts in a D1 database (Drizzle writes the
tables). The browser holds only a session cookie, good for a year and pushed
back each visit. There is no guest play on staging or production.

**One person, one account.** Signing in with Google and with Discord, using an
email each service says it has verified, is the same account, so a player never
ends up with two characters by using both. A Discord email Discord did not
verify is never merged into anybody else's account.

**The browser never holds the key the worlds use.** Each account has one private
key, kept in D1. When a browser connects to a world, the web Worker reads the
cookie, looks the key up, and tells the world which player is connecting,
throwing away anything the browser put in the address. A browser can no longer
claim to be someone else. The worlds themselves did not change for this: they
still save characters under a key, exactly as decision 0057 describes.

**The login credentials are secrets in Cloudflare.** Google's and Discord's
client id and secret are set by hand as secrets on each web Worker, never in the
repository. A service without both is simply not offered, so the sign-in screen
only ever shows what works. Each service is told one return address per
environment, `https://<the Worker's address>/api/auth/callback/<service>`.

**Test players, for tests and previews only.** Google and Discord cannot sign
anyone in on a pull request preview, whose address is new every time, and the
browser tests cannot use them at all. So the Worker also has a "test player"
account that needs no login. It is switched on by a setting (`TEST_SIGN_IN`) that
only localhost and the browser tests have, and previews are given when they are
uploaded; and it is honoured only on localhost and preview addresses, so even a
setting copied to staging by mistake does nothing there. The staging deploy
checks that it is off.

**Existing characters carry over.** A browser that played before accounts sends
its old key once, after signing in. The account may take it if it has never
joined a world and nobody else holds that key, so nobody starts again, and no
account can swap away a character it already has.

**Cloudflare does the rest.** Starting to sign in is limited per address by
Cloudflare's own rate limiter; coming back never counts. CI creates each
environment's database and a random session secret itself, using
`tools/prepare-accounts.mjs`. Staging and production keep one database each;
every pull request preview shares one throwaway database.

## Consequences

- Before anyone can sign in on staging or production, someone has to make the
  Google and Discord apps and add their four secrets to the Worker (the README
  has the exact steps). Until then the sign-in screen says it isn't switched on.
- Previews can't try the real Google or Discord sign-in. That is tested on
  staging after merging, and by the tests, which walk the whole return trip with
  stand-ins for the two services.
- Progress now survives a lost cookie, a new computer and a new browser, as long
  as the player signs in the same way again.
- Every connection costs one D1 read. Fine at this size; a cache is the answer
  if it ever isn't.
- The game server is still reachable by key if someone finds its address. The
  keys are unguessable and never sent to other players, so this is no worse than
  before, but locking the game server to the web Worker is worth doing.
- `VITE_GAME_SERVER_URL` is gone. A login cookie cannot safely follow a page to
  another site, so playing a local client against the staging server no longer
  works. Open the staging link instead.
- The Cloudflare API token needs **D1: Edit** and **Workers Scripts: Edit**
  permission for CI to create databases and secrets.
- Google's consent screen has to be published ("In production") or only the
  people on its test list can sign in.
