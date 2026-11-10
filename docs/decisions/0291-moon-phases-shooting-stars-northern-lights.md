# 0291 — Moon phases, shooting stars and northern lights

## Context

The night sky (decision 0290) had stars and a moon that was full every night.
Chris asked for the follow-ups: phases, shooting stars and the rest.

## Decision

- **Moon phases.** The moon goes from new to full and back over six nights,
  one season. It holds one shape for a whole night and steps on at noon, when
  it cannot be seen. On the new-moon night there is no moon. A thin moon
  throws a smaller glow. The moon still rises at dusk whatever its phase,
  which is not how a real moon behaves but keeps every night's moon in view.
- **Shooting stars.** On an ordinary night one falls every half minute or so.
  About one night in six is a meteor shower, with one every few seconds.
- **Northern lights.** A green-to-violet curtain across the north, with slow
  drifting rays. Likely on winter nights (about 7 in 10), sometimes in autumn
  (3 in 10), rare in spring and never in summer. Decided once per night.
- **The same for everyone.** All three are worked out from the world's seed
  and the shared clock, with no messages from the server, so players standing
  together see the same shooting star at the same moment.
- **Scenery only.** None of it changes how bright the night is or anything
  else in play. Cloud, blizzards and tunnels hide all of it, as with the stars.

## Consequences

- Nights differ from one another, and a clear winter night is worth staying
  up for.
- The light on the ground does not dim on a new-moon night; it could later.
- These are natural hooks for the planned world events (a named meteor-shower
  night, for example), which would need the server to know about them.
- In the gallery, `?gallery=skyline&view=moon&moon=0.17` sets the phase (0
  new, 0.5 full), and `&view=stars&aurora=1&meteor=0.6` shows the northern
  lights with a shooting star held part-way down its fall.
