# 0236 — Bound forest preparation during travel

Grass previously prepared a tile ahead of the player, but a layout refresh still generated every missing tile synchronously. A turn or relocation could therefore bypass preparation. Tree state snapshots also rebuilt every changed camera collision cell together.

Keep the first complete grass layout behind the existing loading screen. During play, generate at most 150 seeded candidates per frame, choosing the nearest missing tile and abandoning work after relocation. Draw only completed tiles; retain the existing distance fade and preparation margin. Cache biome weights with their immutable clumps. Camera collision rebuilds drain one deduplicated cell per frame; authoritative gameplay collision remains immediate.

The repeatable CPU workload in `apps/client/bench/grass-travel.ts` (100 cold travel updates, excluding initial layout) measured p95 34.6 ms / max 35.7 ms before, p95 6.7 ms / max 14.1 ms after on the same runner. These are CPU workload measurements, not browser FPS. Tests bound terrain samples per travel update and retain terrain/water/coverage checks. After a teleport, distant grass fills progressively rather than blocking movement.
