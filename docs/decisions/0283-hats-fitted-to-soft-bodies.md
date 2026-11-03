# 0283 — Hats fitted to the soft bodies

## Context

Chris noticed gear doesn't show on the player. Both player bodies are now the
soft Meshy bodies (`0272-soft-dwarf-bodies.md`, `0275-two-bodies.md`), each one single mesh on the shared Rig_Medium
skeleton. Every hat was made for the old KayKit heads, which are about two and a
half times bigger and sit higher, so the client hid all worn gear on the soft
bodies rather than show it floating. The wool cap and the Last Watch helm were
drawn in code or bolted rigidly to the head bone.

## Decision

- Every helm-slot item is a skinned file fitted in Blender to both soft heads:
  the knight helmet, mage hat, bear hat and rogue mask from the KayKit pack, a new
  wool cap, and a worn copy of the Last Watch helm (`last-watch-helm-worn.glb`).
  The king's crown still borrows the Last Watch helm. `tools/art/soft_hats.py`
  rebuilds them all; `assets/gear/soft-hats.blend` is the source.
- Each hat is weighted wholly to the `head` bone, so it follows the head through
  every animation on either body.
- The client always draws helms. Clothes stay hidden on the soft bodies until
  they are refitted, one family per pull request.
- Raiders and a helm lying on the ground keep the original
  `last-watch-helm.glb`.

## Consequences

Players can see their hats again. One file serves both bodies, because they share
a skeleton and their heads are almost the same size; a much bigger head would
need its own fit. Body 1's longest beard pokes through the rogue mask. The jacket,
shirt, tunic, coat, trousers, boots and gloves still need fitted art.
