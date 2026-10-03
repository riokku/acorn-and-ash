# 0070. Entering the woods

**Status:** accepted · **Date:** 2026-10-02

## Context

Chris asked for a beautiful Pacific Northwest landscape loading screen, a
progress bar, and wording such as “Entering the woods…”.

## Decision

A generated dawn landscape frames misty evergreen ridges, a river, and a warm
cabin. The locally bundled WebP is about 215 KiB and has an explicit provenance
row in the asset register. OpenAI is added as a recognized generator for this
user-requested artwork; the existing checks for other asset sources remain.

Progress reports completed milestones: renderer setup, world arrival, nine asset
groups, scene construction, and the first rendered world frame. It never advances
on a timer. The percentage is a stage indicator, not downloaded bytes or time
remaining. Connection failures retain readable status, and preparation failures
show a retry action. Duplicate arrival requests cannot construct competing worlds.

The progress bar exposes its value and stage to assistive technology, respects
reduced motion, and fits short windows. Drawing behind menus runs at most once per second
while simulation and networking continue, keeping settings responsive during
software rendering. Gameplay drawing is unchanged.

## Consequences

Slow stages may hold the same percentage until they finish. Rendering happens
through the normal game loop, avoiding overlapping shader compilation and drawing.
The source landscape remains available for future art adjustments.
