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

**Knight renders 40% smaller than the pack's own scale**, per Chris's
playtest note that the model read as too large. A flat multiplier on the
whole model, nothing to do with the collision capsule or any gameplay
number - purely how big the art draws.

**The axe you're carrying is now visibly held, not just a HUD line.** It
parents the exact same model the axe pickup already uses onto the pack's
own hand-socket bone (`handslot.r`) - a real node in the skeleton - so it
moves and rotates with the arm through every animation already built, with
no per-frame code of its own needed. Scaled up to cancel the character's
own 40% shrink, since it's the same physical axe as the one lying in the
stump and shouldn't shrink just because the person holding it did. Shown
only for the local player: the wire snapshot has never carried what anyone
else is carrying, only your own, so a remote player's held axe would need
a small protocol addition this pass didn't make.

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
- The held axe's grip - exactly how it sits and angles in the hand - is a
  first guess (`HELD_AXE_ROTATION`/`HELD_AXE_OFFSET` in `character.ts`),
  not something measured against a render: the same sandbox slowness noted
  above got in the way of confirming it visually before shipping. The scale
  change and the facing fix, by contrast, were both visually confirmed live
  - the same screenshot that showed a smaller character also happened to
  show it correctly facing away from the camera.
- Only the axe attaches to a hand for now - the rod, and anything else
  carryable, still show only as a HUD line. The same bone-attachment
  approach applies directly whenever one of those gets the same treatment.
- The held axe never actually appeared: Chris picked one up and could chop
  with it, but nothing showed in the character's hand. The lookup was
  searching for a bone literally named `handslot.r`, matching the source
  file - but Three.js's `GLTFLoader` strips dots from every node name it
  loads, since `PropertyBinding` reserves `.` as the separator between a
  node's name and an animated property in a track path (`someBone.position`,
  for instance). The live name is `handslotr`. Every other bone was renamed
  the same way and kept working regardless, since nothing else in this
  client looked one up by name - clips reference bones by the same
  (consistently sanitized) name on both sides, so animation playback was
  never affected, only this one direct `getObjectByName` call. Confirmed
  fixed by inspecting the actual live scene graph in a real browser -
  `handslotr` resolves, the axe group attaches with its three parts, and it
  correctly starts hidden until `setHoldingAxe(true)` is called - rather than
  by the static Blender/glTF inspection that had first suggested the name
  was fine, which was true of the file but not of what the loader does with
  it.
- Once visible, the grip itself was wrong: Chris described it sticking
  straight out to the side, and asked for something closer to upright, plus
  an actual swing landing on the tree. The first attempt's rotation was on
  the hand-slot bone's local X axis, which turned out to barely move the
  handle at all - measuring the live angle between the handle and straight
  up (in a running browser, sampled at several rotation values on each axis
  in turn) showed X changing that angle by only a few degrees across its
  whole useful range, while the same sweep on Z ran cleanly from 33 to 148
  degrees. That measurement is also what caught something the Blender-side
  numbers alone would have missed: the idle animation moves the arm well
  away from the rig's bind pose, so a bind-pose-only calculation of the hand
  bone's rest rotation would not have matched what actually renders.
  `HELD_AXE_REST_Z` (1.05 radians) was picked directly off that curve for
  landing on the ~30 degrees asked for, rather than guessed and shipped
  blind the way the first attempt was.
- The swing sweeps the same Z axis by a further 1.3 radians and back, on a
  quarter-second sine arc, confirmed by stepping the character's own
  `update()` with fixed time slices rather than waiting on real frames -
  this sandbox's rendering is slow and uneven enough that polling on a
  timer caught almost nothing happening between samples, even though the
  swing was, underneath, always running correctly. Which real-world
  direction that arc reads as - a forward chop rather than something
  backwards-looking - has no equivalent number to sample for and so is not
  confirmed, unlike the rest angle.
- The swing needed knowing whose chop it was: everyone nearby is already
  told the same `treeHit` message a chop produces, with no swinger identity
  on it, so playing a swing back on every `treeHit` would have made a
  player's own axe swing along with a stranger's chop too. `TreeHitMessage`
  now carries `netId`, taken from the server's own chop event (it already
  knew whose swing it was, `world.ts` just was not sending it), so the
  client can play the animation only when it was its own player's swing
  that connected. Scoped to trees only: a raccoon fight's equivalent
  `ThreatHit` can also fire with no swing behind it at all, for a threat's
  own arrival or respawn, which needs its own look before the same
  treatment applies there.
- The 30 degree angle was right, but the blade pointed the wrong way - Chris
  could see it was behind the player once the axe was actually visible, and
  asked for a half turn plus a further 20 degrees forward. Which end of the
  model is the blade was checked directly this time rather than assumed:
  the axe's own vertices cluster into a wide, blade-shaped mass at the high
  end of its local Y and a narrow handle shaft down to the low end, the
  same file `clearing.ts` already draws standing blade-up as a pickup. The
  attempt at the half turn - adding `Math.PI` to the same Z axis the grip
  leans on - was wrong: negating every component of a direction does not
  land the same distance off vertical, it lands close to the *supplementary*
  angle, on the far side of horizontal from where it started. Since the
  grip was already close to vertical (30 degrees off it), its negation
  landed close to vertical too, just pointing down instead of up - a bug
  caught only once Chris reported the axe now hanging into the ground,
  which is exactly what a handle pointing 150 degrees off vertical (30
  degrees off straight *down*) does. The further 20 degrees of forward lean
  used `HELD_AXE_REST_X`, the axis a first attempt wrongly reached for to
  control the upright amount, which does move the axe once a Z turn is
  already in the mix - chosen positive because that direction measured as
  more forward relative to the character's own facing.
- Fixing the hanging-into-the-ground bug also fixed the still-backwards
  blade, once the actual mechanics were worked out properly: a further
  `Math.PI` on Y, on top of the already-turned Z, puts the vertical
  component back where it was (the same ~30 degrees off straight up
  returns) while leaving the forward and sideways components flipped from
  the original ungrafted grip - the combination that was actually wanted
  the first time. Confirmed this time by reading the axe's real world Y
  position alongside the angle, for both the resting grip and several
  points through the swing, rather than trusting the angle number alone
  the way the previous attempt had. Which literal compass direction
  "forward" turns out to be on screen is, like the swing's own direction,
  still not something this pass could confirm without a render - only that
  the numbers move the way Chris described them, and that the blade no
  longer dips below the ground getting there.
