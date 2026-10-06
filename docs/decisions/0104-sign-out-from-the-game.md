# 0104 · Sign out from inside the game, after a ten second wait

## Context

The only way to sign out was a small link on the character screen, before entering the world. Chris asked to be able to sign out from inside the game too, with a ten second countdown, and later asked that the button be in **Settings** (the gear), where he looked for it and did not find it. This is the second of four changes asked for together, after the front door (decision 0103).

A character does not leave the world the instant a tab is closed: it stays standing there until the server notices. So signing out from the middle of a fight, or a walk, deserves a short, honest wait.

## Decision

- **Where it is.** Settings → General has a new **Account** section at the bottom with a **Sign out** button. The character screen's Settings has the same button, which signs out at once, since nobody is standing in a world yet. The old "Sign out" link on the character screen stays.
- **The wait.** Pressing Sign out in the game starts a ten second countdown. The Settings panel closes so the player can see the game, and a banner at the top of the screen counts down with a **Cancel** button. Reopening Settings shows **Cancel sign out** in the same place.
- **What cancels it.** Moving, jumping, swinging, charging, rolling or casting; getting hit; the Cancel button. Moving or being hit says why for four seconds ("Sign-out cancelled because you moved"). The Cancel button says nothing, since the player already knows.
- **When it runs out.** The game asks the site to end the session, forgets that Play was pressed in this tab, and reloads, which lands on the front page signed out. Once the request has gone out it can no longer be cancelled.
- **If it fails.** The site not answering, or refusing, leaves the player signed in, in the game, with a message to try again, instead of sending them to a screen that still knows who they are. (The character screen keeps its older behaviour of starting over regardless.) `signOut` in `net/account.ts` now rejects when the site does not agree, so callers can tell.
- **Where the code is.** `hud/sign-out.ts` holds the countdown as plain code with no browser parts, so it is unit tested with a fake clock. The game tells it when the player moved or was hit (`Game.updateLocalPlayer` and `hearAboutHealth`); the HUD shows what it publishes; `main.ts` supplies what "leave" means.

## Consequences

- The countdown runs on the player's own clock. It is a courtesy and a safety net for the player, not something the server relies on, so a modified browser can skip the wait and sign out sooner. That costs nothing: signing out is always allowed.
- Sitting down or standing still in a fight does not cancel the countdown; only being hit does. If a wait of ten seconds proves too long or too short, `SIGN_OUT_SECONDS` is the one number to change.
- The browser tests wait the real ten seconds once. They use the same skip-the-drawing switch as the rest (decision 0100), since a count in real time cannot wait for slow frames.
