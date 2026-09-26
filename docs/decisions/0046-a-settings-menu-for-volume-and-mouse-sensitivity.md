# 0046. A Settings menu for volume and mouse sensitivity

**Status:** accepted · **Date:** 2026-09-26

## Context

Chris asked for a way to adjust a few settings, from the Home screen or once
inside the world, starting with volume and anything else that made sense.
Audio (decision 0032) already had three sound levels baked in as fixed
numbers, and the mouse-look speed in `game.ts` was a fixed constant too -
neither was ever exposed to the player.

## Decision

**Three sliders, not an options screen.** Music volume, sound effects volume,
and mouse sensitivity - the things a player is actually likely to want to
change this early. There is nothing to expose yet for graphics quality, key
rebinding, or gamepad, which the roadmap already puts in a later phase. Each
slider is a multiplier on top of what is already tuned (1 for volume keeps
0032's levels exactly as they were; 0.5-2 for sensitivity keeps 1 as today's
speed), so a player who never opens the menu sees no change at all.

**One `SettingsMenu` component, dropped into both the Home screen and the
in-game curtain.** A gear button fixed to the top-right corner opens a small
parchment-styled panel - the same "field journal" material the hotbar and
craft/build panels already use (0043), so it reads as part of the same
system rather than a bolted-on options dialog. In-game it only shows while
the curtain is up (`!pointerLocked`): under pointer lock there is no visible
cursor to click a button with anyway, so this rides the existing "Esc, then
click to resume" flow instead of adding a second way to pause.

**The component itself only knows the values it is given.** It takes an
`initial: Preferences` prop and calls `onChange(preferences)` on every slider
move; it never touches `localStorage` or the audio module itself, the same
way `Home` already treats player identity - read once by `main.ts`, written
back through a callback. This was not just tidiness: an earlier version had
`SettingsMenu` import `audio/sound.ts` directly, and `Hud.tsx` (which renders
`SettingsMenu`) is exactly the module `test/hud-hint.test.ts` imports to unit
test the `hint()` function. `sound.ts` does several build-time `?url` asset
imports that Vite understands and plain Vitest does not, so that import broke
an unrelated, previously-passing test. Keeping the component free of any
side-effecting import fixed it, and is the right rule going forward -
nothing reachable from `Hud.tsx` or `Home.tsx` should assume it will only
ever be imported by the real app.

**`main.ts` is the one place preferences are read, written and applied.** It
reads them once at startup, before any sound can play, and again fresh each
time the player presses Play (in case the Home screen's own Settings menu
changed something since the page loaded). The in-game menu's `onChange`
saves the choice and calls the new `Game.setLookSensitivity(multiplier)` -
sensitivity has nowhere else to apply itself the way volume does by writing
straight to an `HTMLAudioElement`.

## Consequences

- Chris, or anyone else, can turn music and sound effects down (or off), and
  make the camera turn faster or slower, from either the Home screen or a
  paused in-game curtain. Choices persist across visits in `localStorage`,
  the same way the chosen name, character and tint already do.
- Nobody who never opens the menu notices any difference - every default is
  a 1x no-op on the levels and speed that already shipped.
- No graphics settings, key rebinding or gamepad support yet - there is
  nothing to expose for any of those right now, and gamepad in particular is
  an explicitly later phase.
- Confirmed live in a real (if software-rendered) browser: the Home screen's
  gear button, all three sliders (including watching Music volume and Mouse
  sensitivity actually move and their percentages update), and the choice
  surviving a real page reload by reading it back out of `localStorage`.
  In-game, the same gear button was confirmed to render correctly on the
  paused curtain - reached by starting play (pointer lock genuinely engaged)
  and then calling `exitPointerLock()`, the same thing Esc does, which
  correctly brought the curtain back. The very last click to reopen the
  panel a second time inside that same session timed out under this
  sandbox's software-rendered scene, which pegged multiple CPU cores hard
  enough that even simple browser automation calls became slow - not
  something this change caused, since the exact same "click the curtain"
  interaction happening earlier in the same run had already succeeded once
  it was given a longer timeout. Two Playwright specs now cover this
  properly in `e2e/play.spec.ts`, with the generous timeouts the rest of that
  suite already uses for this reason.
- Full monorepo typecheck, lint, formatting and unit tests are clean (685
  tests, 23 of them new for the `preferences` module), and the production
  client build succeeds.
