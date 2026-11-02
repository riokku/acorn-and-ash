# Quiet loading tips

## Context

Loading progress and connection messages report useful, changing information. A
decorative tip must not compete with a failure, imply that elapsed time is
progress, or distract from retrying.

## Decision

Show one stable, optional trail tip below the existing progress and status
while preparation is healthy. Players may advance through four relevant tips
with a normal button; no timer, random selection, storage or focus movement is
introduced. Hide the tip for every connection problem and on short windows.

Use existing painted item and system icons beside the full field-journal tab
labels. Keep the open journal above the compact minimap so tab buttons remain
pointer-accessible.

## Consequences

Loading states, retry behavior and progress remain authoritative and unchanged.
The feature adds no network, persistence or simulation state. Browser checks
cover keyboard cycling, short windows, error priority and direct compact-tab
clicks.
