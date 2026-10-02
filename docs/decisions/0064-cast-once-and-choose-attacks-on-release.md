# 0064. Cast once and choose attacks on release

**Status:** accepted · **Date:** 2026-10-02

## Context

Fishing repeatedly restarted the casting animation instead of settling into
waiting. Holding left click also performed a light swing before starting a
strong attack, so a player could not choose only the strong attack.

## Decision

The animator remembers the last fishing state requested by the game separately
from its automatic transition to the waiting clip. Repeating that requested
state each frame does not restart the cast. A bite, catch or cleared line still
changes the animation, and a subsequent cast starts afresh.

For attacks, a short click performs a light swing on release. Holding for
400 ms starts only the strong wind-up. A fully prepared attack stays ready while
held and strikes on release. Releasing before preparation finishes still pays
the full wind-up time; it cannot produce an instant strong attack. Client
prediction and the authoritative server use the same release rule.

Casting and hooking remain immediate on press, since reacting to a bite should
not wait for the attack choice. Placement, pause and loss of focus discard the
pending mouse press. Right mouse remains available to turn the camera.

## Consequences

Light attacks wait until release, but do not wait for the 400 ms threshold.
Players can prepare and aim a strong attack without an unwanted light swing.
The prepared attack can be held while creeping, and remains interruptible by
hits. The HUD explains release to strike. This supersedes the timer-triggered
strong strike in decision 0026 and the initial light swing while holding in
decision 0050.
