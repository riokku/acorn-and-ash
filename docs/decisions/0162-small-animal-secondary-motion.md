# 0162 — Small-animal secondary motion

## Context

Rabbit, masked-raccoon and fox figures were static as the server moved them around. Articulated wildlife also kept animating from reported velocity while displayed positions were held. The fox asset has no skin rig or animation clips.

## Decision

Wrap the existing small-animal figures in a motion pivot: soft rabbit hops, restrained raccoon/fox body motion, idle breathing and blended threat/defeat responses. Motion follows analytically integrated eased travel, with smooth contact curves and deterministic per-animal phase offsets. Drive all wildlife from interpolated visible travel, as player and skeleton gaits do. Existing galleries preview the small-animal motion.

## Consequences

The current figures gain continuous movement and stops without replacing art or changing world positions, targeting, collision or behaviour. The wrapper owns no new geometry or materials and delegates cleanup to the original figure. This adds secondary body motion; full fox leg cycles require a separately rigged asset.
