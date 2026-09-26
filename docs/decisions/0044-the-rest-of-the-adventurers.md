# 0044. The rest of the adventurers

**Status:** accepted · **Date:** 2026-09-26

## Context

Decision 0036 converted Knight, the first of KayKit's six free Adventurers,
to prove out real skeletal animation - and deliberately stopped there,
converting and licensing the other five "would be wasted effort if the
approach needs adjusting once real animation is actually running." It
didn't need adjusting. The Home screen (0037/0038) already shipped a full
name/character/tint picker with all six characters named and shown, five
of them locked behind `available: false` and a "Coming soon" badge,
waiting for exactly this.

Chris asked, overnight, to rig up the other five so people could actually
pick them.

## Decision

**Same pipeline, five more times.** Barbarian, Mage, Ranger, Rogue and
Rogue Hooded were converted with the same two-stage process as Knight: a
generalized version of its Blender script (`convert_character.py`) imports
each character, strips the same stray `Icosphere` placeholder mesh every
one of the six ships with, merges in the same four `Rig_Medium` NLA
clips - Idle_A, Walking_A, Running_A, Jump_Idle - and exports GLTF_SEPARATE;
then `tools/import-model.mjs` Meshopt-compresses it into `assets/characters/*.glb`
the same as everything else. All six share Knight's exact rig and bone
names by design (confirmed directly in Blender before converting anything,
not assumed), so nothing about the process needed to change per character.
Triangles ranged 6.7k-8.9k, all comfortably under the 10k player budget.

**Nothing about `character.ts`'s render code changed.** The 180-degree
facing correction, the `handslotr` hand-bone lookup, the held-item grip
numbers, `SkeletonUtils.clone` - all of it was already written against
"whatever template is passed in," never against Knight specifically. The
only real change was generalizing the _loading_ side: `character-model.ts`
went from one bare `template` variable to a `Record<CharacterId,
AnimatedModel>`, preloading every character's own glTF the same way
`prop-models.ts` already preloads every tree and rock kind. `createCharacter`
gained a `character: CharacterId` parameter to pick the right one; `game.ts`
threads the local player's chosen character and each roster entry's
`character` field through to it, mirroring the existing `colorFor` fallback
with a new `characterKindFor`.

**The picker itself needed no code changes at all.** Home.tsx already drew
a `CHARACTER_ORDER.map` grid keyed off each kind's `available` flag; flipping
that flag to `true` for the five in `packages/shared/src/data/characters.ts`
is the entire "unlock" - the lock icon, "Coming soon" label and disabled
state simply stop applying because nothing sets them anymore. Same story
server-side: `handleHello`'s `CHARACTER_KINDS[requestedCharacter].available
? requestedCharacter : DEFAULT_CHARACTER` gate, and the wire encoding for a
six-way `CharacterId`, were both already built for this exact moment.

**The gate stays in the code, not removed.** Every character is available
today, but `available` is still a real field on every row rather than
deleted - it's exactly how a future seventh character (or a returning
locked one) gets shown-but-disabled the same way these five were, without
reinventing the mechanism.

## Consequences

- One existing test lost its premise: `world.test.ts` had "locks a character
  that is not available yet" using Mage as its example of a locked id. With
  every id now available, there is no real `CharacterId` left to test the
  locked side of that gate with - encoding a made-up string throws in
  `characterIndex` before the test could even send it. Replaced with a test
  that mage (or any character) now really is honored end to end, with a
  comment pointing at this decision for why the old one changed shape rather
  than just being deleted quietly.
- Verified two ways, neither of them the full networked game: a standalone
  Vite page (no wrangler, no WebSocket) rendered all six side by side using
  the real `character-model.ts`/`character.ts` code, confirming by eye that
  each one loads with its own distinct art, faces the right way from both
  sides, and its walk clip visibly advances frame to frame - and a
  structural check of the actual scene graph confirmed all six find their
  `handslotr` hand bone, create all six holdable items, and show exactly the
  one requested when equipped. Deleted before this shipped; not part of the
  real game. The full multiplayer e2e suite was not run for this pass -
  CI's own "Browser smoke tests" job has independently taken 2.5+ hours and
  failed on every one of the last several PRs on this branch regardless of
  their content, a standing issue bigger than this change (see the comment
  on this PR).
- Still first guesses, unconfirmed by anyone but this pass: the held-axe
  grip was only ever measured against Knight's proportions, and the same
  numbers are reused unchanged for all five new bodies. Barbarian in
  particular reads noticeably bulkier than Knight in the side-by-side
  render; worth a look if the axe or rod sits oddly in a stockier
  character's hand once someone actually plays as one.
- Every new character reuses Knight's tint-by-multiply approach untested
  against its own base texture - amber was the only tint checked here.
