# Static portraits for the body picker

## Context

The six playable bodies share a generic person symbol on the entry screen.
A player cannot compare their shapes until choosing each one in the live stage.
The painted icon pass also left flat fish drawings and a font-dependent raid
skull alongside the illustrated inventory artwork.

## Decision

Bake six transparent body thumbnails from the current playable models through
an opt-in gallery. Use one renderer, common lighting and orthographic framing,
a fixed idle pose, the default skin and beard, and each model's neutral materials.
Preserve the bodies' relative proportions and show their full silhouettes.
The picker uses ordinary images; its existing live stage shows selected colors
and skin tones. Labels, availability, selection, focus and play behavior remain.

Reproduce the images with `tools/render-body-icons.mjs` against the client dev
server. Record source model hashes in `docs/design/body-portrait-sources.json`;
a small asset-integrity check requires regeneration after a model changes.
Retain the source models' credits and licenses on each derived image.

Reuse the existing painted species illustrations in the fishing journal. Add
one compact painted skull sprite to the shared system-icon renderer for raids.
Keep the threat color and count labels, and use decorative image semantics
beside the existing readable names and status text.

## Consequences

The body choices become visually distinct without adding runtime canvases.
Static thumbnails show the neutral bodies; the large stage remains the preview
for customization. Model replacements require refreshed picker images. The
fishing journal and raid badge gain consistent art without gameplay changes.
