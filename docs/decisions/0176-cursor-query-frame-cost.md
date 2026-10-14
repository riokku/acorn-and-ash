# Cursor query frame cost

The five-ray cursor tolerance refreshed every loot hierarchy and rebuilt its object list for each ray. Occlusion checks also refreshed every blocker repeatedly and gathered/sorted all blocker hits just to decide whether any existed.

Prepare transforms, target roots and ownership once per pointer query, then reuse them across the same five probes. Blocker transforms are refreshed lazily once, and an occlusion ray stops at the first blocking object. Nothing is cached across frames, so moving/bobbing loot and changed scenery remain accurate. Direct-hit priority, hidden ancestors, candidate order, terrain occlusion, the 3-pixel tolerance and restored pointer/range are preserved.

A local CPU benchmark with 240 six-part loot groups behind a blocker reduced median query time from 1.217 ms to 0.693 ms (43%). This isolates cursor work, not whole-game FPS. The benchmark is reproducible with `pnpm --filter @acorn/client bench:cursor`. Tests preserve targeting behavior and verify moved objects are refreshed on the next query. Existing browser cursor/drag/loot checks cover the game integration.
