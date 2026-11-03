# 0280 — Scenery wildlife: ducks, frogs, crows and owls

## Context

Chris asked for owls, crows, ducks and frogs, using Polyfork's free models
(decision 0272), to make the forest feel more alive. On 2 November 2026 he
chose "scenery only": they move about and scatter when someone comes close,
but nobody can hunt them and they drop nothing. He also chose to place them
"by their nature": ducks and frogs by the pond and the lake, crows on the open
ground round the clearing, and owls in the deep woods, mostly at night.

## Decision

- Each player's own game draws them in `apps/client/src/scene/scenery-wildlife.ts`,
  the way it draws the fireflies. The server does not track them. Their home
  spots come from the world's seed, so everyone in a world finds the same
  ducks on the same water.
- Ducks are on the home pond (always a pair) and scattered across the lake.
  Frogs sit on the bank. Crows live 34–90 m from the clearing's middle and
  owls 140–420 m out. One owl in five is also about by day.
- Only those within 70 m are drawn. Ducks and frogs are gone while the lake is
  frozen. Owls (apart from the daytime ones) appear once the light falls.
- Each one scatters when someone comes near. A duck paddles away but stays on
  the water. A frog hops off. A crow or owl flies up and away using the
  model's Fly clip, which `polyforkAnimal` can now blend in. Each comes back to
  its spot after about half a minute, once nobody is close.

## Consequences

They cost nothing on the server and need no network messages. Because each
game moves them on its own, two players may see the same duck paddle off in
slightly different directions. That doesn't matter for scenery, but if they
are ever made huntable they must move to the server like the other animals.
The four models add about 3,000 triangles each; they are drawn only nearby, so
only a handful are on screen at once.
