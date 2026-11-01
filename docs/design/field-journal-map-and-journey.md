# Map, journey and fireside notes

The world map, loading card, fire-fuel panel and cabin log storage now share
the journal's parchment, fir binding and copper accents. The map keeps its
painted terrain and inked markers. Its header and controls match the journal,
and a copper outline makes keyboard focus visible. Reduced-motion settings
also suppress the map's entrance animation.

The loading card keeps the existing landscape and real preparation milestones,
with fir progress ink on paper and a matching retry button. Fire and storage
notes use the same paper, button hierarchy and quieter helper text. This pass
changes CSS only; the controls and gameplay rules stay in their components.

## Reviewed evidence

These captures use the actual React components with controlled sample state,
the production map painter, and a fixed game screenshot behind in-game panels.
The landscape behind loading is the actual painted backdrop. Chromium checks
covered map zoom, pan, re-centering, close, keyboard focus, storage requests
and a disabled add-log action when the pack has no logs. Both before and after
runs completed without page errors. The existing fire-fuel browser case also
passed, covering log storage, withdrawal, cabin and outdoor fuel, and full/empty
fire actions against a controlled local simulation.

| View      | Before                                                      | After                                                     |
| --------- | ----------------------------------------------------------- | --------------------------------------------------------- |
| World map | [Before](../previews/field-journal-map/before-map.webp)     | [After](../previews/field-journal-map/after-map.webp)     |
| Loading   | [Before](../previews/field-journal-map/before-loading.webp) | [After](../previews/field-journal-map/after-loading.webp) |
| Fire fuel | [Before](../previews/field-journal-map/before-fire.webp)    | [After](../previews/field-journal-map/after-fire.webp)    |

Additional checks: [map at 900 × 600](../previews/field-journal-map/after-map-narrow.webp),
[retry at 900 × 480](../previews/field-journal-map/after-error-short.webp),
[log storage](../previews/field-journal-map/after-storage.webp), and
[empty pack](../previews/field-journal-map/after-empty.webp).

These are component and layout checks, not an online playthrough or performance
measurement. The fixture does not exercise server persistence or authentication.
Review screenshots use quality-92 WebP to keep documentation size modest.
