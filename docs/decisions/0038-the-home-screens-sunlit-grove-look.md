# 0038. The Home screen's sunlit-grove look

**Status:** accepted · **Date:** 2026-09-25

## Context

Decision 0037 built the Home screen - name, character and tint, before the
game connects - but shipped it in the dark, firelit palette borrowed from
the in-game HUD, and said plainly that its real visual design was "worked
out first as a couple of static mockups shown to Chris... rather than
confirmed pixel-for-pixel against it." Two directions were mocked up: a
dusk firelight clearing, and a sunlit grove in daylight. Chris picked the
sunlit grove. This closes that open thread by matching the shipped screen
to the specific mockup he agreed to, rather than the placeholder dark
theme it launched with.

## Decision

**Re-themed, not rebuilt.** Every field, button and test hook from 0037 -
`#home-name`, `.home-play`, `.home-character`, the "Coming soon" copy -
stayed exactly as it was; only `apps/client/src/home/Home.tsx` and
`apps/client/src/styles.css` changed, so none of the Playwright coverage
0037 added needed to change with it.

**A daytime forest, not a night one.** The dark HUD-matching gradient is
replaced with a warm cream-to-gold one, with pine tree silhouettes (plain
SVG shapes, no art asset) anchored along the bottom edge behind the card -
the same shapes from the agreed mockup, scaled to cover whatever size the
browser window actually is rather than the mockup's fixed preview size.
The title now sets in Fraunces, a serif face, loaded from Google Fonts with
a plain Georgia fallback if that request is ever blocked; everything else
stays the system sans-serif font already used everywhere.

**Selection follows the chosen tint.** The mockup's one interactive detail
worth carrying over exactly: picking a tint now re-colors the selected
character card's own border to match, instead of a fixed highlight color,
and the tint swatches get a matching colored ring instead of a plain one -
so the two pickers visibly agree with each other rather than just sitting
next to each other.

## Consequences

- Confirmed in a real browser, not just judged from the code: the dev
  server was started and screenshotted at desktop and phone widths, and
  driven through picking a name, switching tints and re-selecting Knight to
  confirm the border-matching actually works, not just that it compiles.
  Full monorepo typecheck and lint are clean, the client's unit tests still
  pass, and the Home screen's own Playwright specs pass against the real
  built stack (`wrangler dev`, not just the dev server).
- The Fraunces font request goes over the network on first visit. It fails
  closed to the Georgia fallback rather than a blank title if that request
  is ever blocked - confirmed directly, since this sandbox's own outbound
  proxy blocked exactly that request during testing.
- Not re-litigated: the mockup's own color choices, including a couple of
  secondary text colors that sit a little under typical AA contrast
  guidelines against the lightest part of the background gradient. Chris
  already looked at and picked this exact palette; nudging it further on a
  contrast calculation he wasn't shown would be second-guessing an
  agreed design rather than building it. Worth a look if it ever reads as
  hard to read in practice.
