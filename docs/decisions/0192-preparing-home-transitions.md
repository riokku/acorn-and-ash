# 0192 — Prepare the forest before leaving home

## Context

Signing in inside a home drew only the room behind the initial loading screen.
The first exit then paid for the forest's first render. Meanwhile, the hidden
forest's detail sorting followed room coordinates, and removing scene fog indoors
changed material programs. A fixed 140 ms door hold exposed this preparation.

## Decision

Keep the existing outdoor scene alive. Sort its trees around the outdoor
location, or the current home's doorway, while room movement stays local. Draw
one outdoor frame behind initial loading, at the home when known, before drawing
the server's latest room destination. Queue space changes during initial loading
so a late destination cannot be lost or briefly revealed.

Keep one fog object and shader structure across both spaces; indoors its range
is beyond the room. Weather fog distances continue separately and restore on exit.

A confirmed door transition holds its curtain until three rendered frames settle
(each within 100 ms), with a 140 ms minimum. After 350 ms a quiet status and CSS
spinner appear; reduced motion keeps a static indicator. Gameplay input waits for
preparation, while neutral network inputs and world updates continue. An 8-second
escape limit prevents an unusually slow device trapping someone indefinitely.
Predicted door fades still give up if the server does not move the player.

## Consequences

The initial loading screen includes outdoor drawing even for indoor arrivals.
Rooms do not continuously draw the hidden forest or allocate a second renderer.
Readiness is a practical frame-time check, not a GPU performance guarantee; very
slow devices may still draw slowly after the escape limit. Server movement and
world persistence are unchanged.
