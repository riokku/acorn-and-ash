# Gentle forest weather

## Context

Expeditions should offer changing opportunities without additional survival penalties. Chris approved mostly clear skies/light drizzle, three-to-five-minute rain, occasional one-to-two-minute storms, mushroom opportunities, fallen timber and dusk fireflies.

## Decision

A seeded thirty-minute forecast uses the existing authoritative wall clock, shared through welcome/snapshots. Six minutes of drizzle precede each rain; one quarter of cycles end with a brief storm. Clear skies fill the rest. Rendering eases precipitation and cloud lighting over two seconds; pooled rain respects reduced motion and stays outdoors. Dusk fireflies use 32 instanced meshes.

Mushroom patches give up to two mushrooms per cluster during rain and for six minutes after rainfall. Normal backpack limits and shared depletion apply. Completed storms leave at most six shared piles of logs/branches on unobstructed ground away from landmarks. They follow existing pickup/fade rules. A saved weather cursor and generated piles commit together, preventing reward replay after restart. A sleeping world only considers its most recent completed storm; it never accumulates old storms. A new world creates no retrospective rewards.

Weather changes no hunger, health, combat, movement or building rules. Existing rain-independent regrowth remains intact. No new network message is necessary: clients and server share the forecast function and world seed.

## Consequences

Weather is predictable and reconnect-safe. Balance is deliberately modest; expedition playtests should tune frequency and mushroom yield. Storm windfalls are communal and first-come, like normal gathering.
