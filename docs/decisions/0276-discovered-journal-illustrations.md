# Discovery illustrations follow found progress

## Context

The field journal has painted item art, while discovered landmarks still use
simple sketches. Garden actions and remembered-story rows also have little
visual identity. Illustrations should enrich these pages without revealing
undiscovered places or implying rewards the player has not earned.

## Decision

Keep the existing sketches for unknown discoveries. Instantiate each colored
vignette only when its `discoveryKnown(discoveriesFound, id)` bit is set.
Claimed bits, carried items and learned recipes do not reveal art. Keep every
name, clue, note, status and claim rule. Seven transparent 156 × 128 WebPs fit
the existing 78 × 64 illustration slot, with no new panel or layout priority.

Reuse painted crop icons beside garden headings and actions. Existing copy
continues to distinguish growing and harvest-ready plots; do not invent growth
stages or a universal sprout that would misrepresent mushrooms. Preserve all
restrictions, quantities and requests.

Use the existing trail-pennant illustration as a common mark for remembered
rumors, alongside existing completion text. Unknown rows keep their diamonds.
The saved cosmetics bits do not record historical reward variants, so stamps
must not claim a particular past reward.

## Consequences

The journal rewards exploration with color while keeping undiscovered entries
quiet. All art remains decorative beside readable text and actions. A read-only
`journal-art` gallery previews the real components without server changes. New
assets need license entries; unit and browser checks cover reveal gating and
preserved behavior. There are no simulation, network or persistence changes.
