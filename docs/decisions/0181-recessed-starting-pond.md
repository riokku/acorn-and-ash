# Recessed starting pond

## Context

Chris requested a bank that makes the starting pond feel sunken, and a less symmetrical outline after enlarging it.

## Decision

The pond uses four unequal, offset lobes: a broad main pool, a narrower eastern end, a small northern inlet and a southern cove. It remains about twice its original water area, with the first fishing rod on the same dry bank.

A shared terrain profile lowers the bed and raises a gentle, variable bank roughly 20–35 cm above the water. Both server and client use this surface for walking, ground placement and camera collision. The muddy shoreline hugs the same profile as one continuous mesh; local ground refinement keeps the physical and visible bank close without increasing detail everywhere. The level water and existing pond barrier stay in place.

## Consequences

Clearing scenery and pickups follow ground height, including on the new bank. Seeded tree IDs and horizontal landmark positions stay stable. Existing flat-terrain fixtures can explicitly supply their terrain. The gallery shows the actual clearing, pond and bank; fishing, reed reach and shoreline-ground checks cover the new outline.
