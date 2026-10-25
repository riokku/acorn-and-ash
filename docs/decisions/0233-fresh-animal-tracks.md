# Fresh animal tracks

## Context

The woodland's existing fixed spoor leads to authored encounter clearings. It cannot tell hunters where a living animal has actually walked. Quiet stalking needs a readable trail to discover and follow.

## Decision

The server keeps a short, ephemeral history for rabbits, jackrabbits, foxes and elk. Every 1.6 metres of real travel leaves a paired impression facing the animal's direction. Spawning, standing, teleporting, caught animals and water do not create prints. Old tracks remain after an animal is caught, so a trail is evidence rather than a promise of a live target.

Prints last up to three minutes in clear weather. Drizzle erodes them twice as fast, rain four times as fast, and storms/blizzards six times as fast. History is capped at 768 marks; viewers receive up to 96 recent marks within 40 metres once per second. A new compact binary message appends wire ID 0x4d. Later arrivals see the same remaining history; it does not persist through world unloading.

The client reuses the existing hoof/paw impression glyphs, projects each vertex onto terrain and fades opacity with remaining freshness. Snow uses the existing cool impression color. A nearby hint identifies the animal and whether the marks are fresh, fading or faint. Existing static woodland leads remain. Space changes clear transient trail views.

## Consequences

Hunters can follow real movement without a new control, map marker or tracking currency. Caps keep memory, network traffic and rendering bounded; busy areas can lose their oldest marks before weather would erase them. This is one focused change; learnable foraging habitats and meal preparation can follow separately.
