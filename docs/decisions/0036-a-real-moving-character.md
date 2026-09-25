# 0036. A real, moving character for the first time

**Status:** accepted · **Date:** 2026-09-25

## Context

Chris sent over KayKit's free Adventurers pack - six characters (Barbarian,
Knight, Mage, Ranger, Rogue, Rogue Hooded) sharing one 23-bone skeleton, two
animation bundles totalling 26 named clips, and around 67 separate weapon
and prop models - with a longer-term plan to let a player eventually pick
one from a menu. Asked how to sequence it, he chose to start on the harder
problem now rather than wait: prove out a real, animated character before
building the picker around it.

That is a bigger step than every art pull so far. A tree, the axe, even the
fox are all static once converted - drop in real geometry, keep the
placeholder's placement code, done. A character has to keep moving: walking,
running, jumping, eventually swinging an axe. Nothing in this client had
ever played a skinned, bone-animated model before - `loadAnimatedModel`
existed only for the campfire's flame, which animates by keyframing plain
object transforms, no skeleton involved.

## Decision

**Knight stands in for every player, for now.** No menu exists yet - that is
explicitly the next, separate piece of work - so every connected player
currently draws the same tinted Knight model. Converting and licensing all
six now, before the system that would tell them apart exists, would be
wasted effort if the approach needs adjusting once real animation is
actually running.

**The model keeps its skeleton, unlike the fox.** Where the fox's rigged
export got its Idle pose baked into a static mesh (0035), Knight's mesh and
23-bone armature are converted whole. Four clips - `Idle_A`, `Walking_A`,
`Running_A` and `Jump_Idle` - are merged onto Knight's own armature in
Blender via NLA strips before export, copied in from the pack's separate
`Rig_Medium` animation bundles since they share identical bone names.
`tools/import-model.mjs`'s existing prune/dedup/weld/Meshopt pipeline needed
no changes to carry a skin and its animations through correctly.

**`instantiateAnimatedModel` now clones with `SkeletonUtils.clone`, not the
plain `Object3D.clone`.** The built-in clone does not re-bind a skinned
mesh's bones to its cloned skeleton - a well-known Three.js gap - so every
character past the first would have shared (and fought over) one skeleton.
Nothing needed this fixed before, since the campfire's flame has no bones;
`SkeletonUtils.clone` handles both cases correctly, so this is a pure
correctness fix with no behavior change for the flame.

**Four states, chosen by one small rule.** `pickAnimationState(moving,
sprinting, airborne)` picks whichever of idle/walk/run/jump fits, airborne
always winning (you cannot run in mid-air) and sprinting beating a plain
walk. The server already computed `Moving`, `Sprinting` and `Airborne` per
player for the wire snapshot, unused until now; `InterpolatedEntities`
gained the last two fields the same way it already carried `Moving`, so a
remote player's own animation reads the same way locally as it does to
everyone else watching them. The rule itself lives in its own tiny,
framework-free file (`character-animation.ts`) apart from `character.ts`,
which pulls in Three.js and the real model - so it can be unit tested
without either.

**A player is still one recognisable colour.** Tinting a whole textured
character by multiplying its material colour is a coarser effect than it
was on a flat-shaded placeholder capsule, but it keeps players telling each
other apart in a shared world, which was worth keeping even at the cost of
a slightly muddier tint. Each character instance clones Knight's one shared
material before tinting it, so one player's colour never bleeds into
another's.

## Consequences

- Every player looks like the same Knight, palette aside, until the picker
  menu exists. That menu, the other five characters, and the rest of both
  animation bundles (walk/run variants, hit, death, interact, throw, and
  more) are separate future work.
- No attack animation yet - swinging an axe still shows no more than a walk
  or an idle underneath it. Syncing a swing's timing to a clip is a
  follow-up once this foundation is proven.
- Confirmed clean: full monorepo typecheck, the client's own test suite
  (including new coverage for `pickAnimationState` and the
  `InterpolatedEntities` extension), and a production build with
  `knight.glb` correctly bundled at a reasonable size (roughly 300 KB).
  Manually watching it animate live in a browser hit the same
  sandbox-specific slowness already disclosed for the campfire feature's
  e2e run (see 0033) - real gameplay traffic and a genuinely rendering,
  correctly-sized character mesh were confirmed with no console errors or
  exceptions across several runs, but a screen recording of it visibly
  stepping through all four poses was not something this pass could pin
  down before deciding it was not worth chasing further.
- That verification gap is exactly where a real bug was hiding: Chris found
  in actual play that the character walked facing backwards. Knight's own
  rig faces the pack's +Z; this game's convention is yaw 0 = facing -Z (see
  the placeholder capsule's snout, built to that convention directly) - an
  exact 180 degree mismatch, invisible to typecheck, unit tests or a build,
  since none of them render a frame. Fixed by rotating the model on an
  inner wrapper rather than the outer group whose `rotation.y` the game
  overwrites every frame with the live facing direction. The same fix will
  be needed for any of the other five characters converted later, since
  they share Knight's exact rig.
