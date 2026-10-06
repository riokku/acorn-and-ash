# 0103 · A front door: the painting, Play, then Create account or Log in

## Context

Chris liked the painted valley on the loading screen and asked for it to be the background of the landing page too, with a **Play** button for a first visit that leads to **Create account** or **Log in**, and proper Google and Discord icons. This is the first of four changes asked for together (the others: a living, seasonal background; a World of Warcraft style character screen; signing out from inside the game). They ship separately so each is a small playable change.

Sign-in today is Google or Discord only (decision 0086). Those services make the account the first time and recognise it afterwards, so "Create account" and "Log in" are the same journey underneath. Chris chose to keep it that way: no passwords, no email sign-up.

## Decision

- **One shared background.** `PaintingBackdrop` (`apps/client/src/backdrop`) draws the painting and a dark fade, and now sits behind the front page, the sign-in choices, the character screen, the "couldn't reach the game" screen and the loading screen. It replaces the old pine-tree drawing on the Home screen. It is fixed to the window, so a screen that scrolls never scrolls the painting away. The later animated and seasonal work happens inside this one component.
- **Front page.** Painting, title, a short line and a **Play** button. For somebody signed in, Play goes straight to their character screen. For somebody signed out, Play shows two tabs, **Create account** and **Log in**, over the same Google and Discord buttons, worded "Sign up with…" or "Log in with…". A browser that has played before opens on **Log in**; a stranger on **Create account**. A **Back** link returns to Play.
- **Icons.** Google's four-colour G on a white button and Discord's mark on its blurple button, drawn inline (no files to download or license). Both brands ask for their own colours, so these two buttons do not follow the game's palette.
- **Play is asked once per tab.** Pressing Play is remembered in that tab only (`sessionStorage`), so coming back from Google or Discord lands on the next screen instead of a second Play. A fresh visit, or signing out, shows the front page again. A sign-in that came back with an error opens on the choices with the message.
- **Tests and local play skip it.** Where test sign-in is automatic (your own machine and the browser tests) there is no front page, as there was no sign-in screen before, so every browser test still starts at the character screen. Previews and the real game show it. The new browser tests pretend to be a signed-out visitor to cover it.

## Consequences

- Someone who is already signed in sees the front page on every fresh visit and presses Play once. That was Chris's choice: one consistent front door, a place for the seasonal scene.
- "Create account" and "Log in" lead to the same place. If email and password sign-up is ever wanted, the two tabs are where it would differ; it would also need an email service for password resets.
- The character screen sits on the painting in a cream panel for now. The character-screen change replaces it.
- Developers on `pnpm dev:web` never see the front page. Open a preview, or the browser test that stands in for a signed-out visitor, to look at it.
