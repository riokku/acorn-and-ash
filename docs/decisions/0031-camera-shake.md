# 0031. A camera kick when a hit lands

**Status:** accepted · **Date:** 2026-09-24

## Context

Every mechanic through Phase 4 was built with no feedback beyond a number
changing: chopping a tree, landing a hit on the raccoon, and taking damage
all look the same as missing. Chris asked to start on P6 polish and picked
"feel and juice" (sound, camera feel, small satisfying feedback on actions)
as the first slice, over a menu/credits pass or a bug-hunting pass.

Sound needs new assets (a CC0 sound pack, sourced the same way the art
packs were); camera feel does not, and touches every combat and gathering
action through one place. That made it the smaller, self-contained piece to
start with, saving sound for a follow-up once there is something to source.

## Decision

**A camera shake, not a hit-stop.** Considered briefly freezing the game's
own update loop for a frame on impact (a classic technique), but that
reaches into client prediction and reconciliation timing - more risk than
this pass is worth. A shake is purely visual, lives entirely in
`FollowCamera`, and cannot affect anything the server or the simulation
cares about.

**Triggered from the broadcast hit messages, not local prediction.** The
client already predicts movement locally, but a swing's cooldown is decided
server-side (see `SWING_COOLDOWN_TICKS`), so the client cannot tell from its
own input alone which tick a swing actually lands on - only the server can.
`treeHit` and `threatHit` are broadcast to everybody nearby, not just
whoever swung, so right now anyone standing near a fight feels a shake for
someone else's hit too. Left as-is: today's usual player counts make this
rare enough not to notice, and narrowing it to "was this my hit" needs
plumbing target ids through the aim-prediction code that do not exist yet
for that purpose. Worth revisiting if it is ever actually annoying, likely
alongside other P5-at-scale work.

**Stacks instead of resetting.** Landing several hits in a row (a charged
attack, a quick flurry) adds to the current strength up to a cap, rather
than each hit restarting the same shake from zero - a flurry should read as
more than one hit, not the same amount over and over.

**Taking damage shakes harder than landing a hit.** `hearAboutHealth` is
already private to whoever it is about, so this one is exactly right,
no caveats: getting hit should feel worse than dishing it out.

## Consequences

- Chopping, fighting the raccoon, and taking a hit all have a small camera
  kick now; nothing else about how they play changed.
- Bystanders near someone else's fight or chopping will occasionally feel a
  shake that was not their own hit, per the tradeoff above.
- Playwright hung again trying to hold a mouse button and screenshot a live
  session in this sandbox tonight - the same environmental issue as
  decision 0030, reproduced on a much simpler interaction this time (a
  single 100 ms click). Verified with a new unit test on the shake math
  itself (stacking, clamping, decaying exactly back to rest) instead of a
  live screenshot, and a plain page load with no console or page errors.
  Worth a real look on the preview link, the same as last time.
- Hit-stop, sound effects, and narrowing the shake to the player who
  actually landed the hit are all natural follow-ups, not done here.
