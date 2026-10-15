# 0195 — Move freely during the whirlwind

## Context

Chris wants to move freely after releasing the charged strong attack and remove
the redundant target label above selected enemies. Decision 0191 planted the feet
through both rotations.

## Decision

Keep the existing charging controls and slow wind-up. From the release tick, the
whirlwind uses ordinary movement: walking, sprinting, jumping, turning and
collision all run through the same shared rules as normal movement. Moving does
not cancel either rotation or skip weapon contacts (refined in decision 0196). Dodge cancellation
remains available after the spin, and movement can finish the short recovery as
before. The animator layers the upper-body strike over walking legs when moving;
standing still retains the balanced whole-body stance.

Keep the gold target diamond and offscreen direction marker, but omit the
additional target name/distance caption. Existing enemy names and health bars,
aim assistance and target cycling remain.

## Consequences

Prediction and the server share the movement rule without a new protocol field.
There is no extra damage or invulnerability. Skeleton AI keeps its existing
attack inputs while using the same shared action clock and animator. Tests cover
free movement without early cancellation, actual movement and radial hits in the
server simulation, and rendered walking legs under the spinning weapon stance.
