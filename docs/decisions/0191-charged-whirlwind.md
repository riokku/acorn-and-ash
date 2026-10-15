# 0191. A charged whirlwind

**Status:** accepted · **Date:** 2026-10-15

## Context

Chris requested a whirlwind strong attack inspired by Bladestorm in World of Warcraft, replacing the forward heavy swing. The player and skeletons share the same move clock and animator.

## Decision

Keep the existing hold-to-charge and release controls. Release commits to two grounded rotations over 0.8 seconds, with a brief entry and recovery (1.1 seconds total). The weapon arm extends sideways, the blade follows a circular trail, and each rotation has a swish. Reuse the existing horizontal slash stance and rig rather than introduce a replacement asset.

The server applies the existing charged damage once to each nearby creature as the first rotation completes. Reach remains the normal melee radius, with a 1.4 m vertical allowance. Historical target samples deduplicate by id. The second rotation adds follow-through without a second damage award. Skeleton charged strikes use the same radial rule against players; their existing delayed hit settlement and dodge checks remain. Light attacks and aerial dodge slams stay directed.

Originally both rotations committed the feet; decision 0195 frees movement
during the spin. Dodge cancellation still waits until the spin ends. A hit can interrupt it; the visual turn settles into the flinch rather than snapping back. No invulnerability is added. If no creatures are reached, the existing aimed single-tree and digging interactions still work.

## Consequences

The strong attack is useful when surrounded without multiplying its per-target damage. Existing action ids and snapshot formats remain unchanged, so prediction and remote interpolation use the same timing data. Old forward-slam descriptions are superseded for ordinary charged attacks; aerial dodge slams retain their existing animation and rules.

Decision 0196 supersedes the single impact tick and aimed-tree fallback: contacts
now follow the weapon arc throughout both rotations and include every reachable
trunk, with one hit per target for the whole attack.
