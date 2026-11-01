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

## Review

Rendered before/after review used the actual React components with controlled
sample state, the production map painter, and a fixed game screenshot behind
in-game panels. The landscape behind loading used the actual painted backdrop.
Chromium checks covered map zoom, pan, re-centering, close, keyboard focus,
storage requests and a disabled add-log action when the pack has no logs.
Both before and after runs completed without page errors. The map fit at
900 × 600; the retry button remained reachable at 900 × 480.

Client TypeScript, stylesheet formatting, diff checks and the client build
passed locally. Screenshot publication and the result of the separate
fire-fuel integration check remain pending because the cloud workspace
connection was lost. Keep the PR in draft until those review items are complete.

These are component and layout checks, not an online playthrough or performance
measurement. The fixture does not exercise server persistence or authentication.
