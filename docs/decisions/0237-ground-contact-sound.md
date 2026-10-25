# 0237 — Let ground contact sound like its surface

Footsteps already follow the visible stride and standing feet already adapt to slopes. Extend that feedback instead of introducing another locomotion controller.

Classify exposed stone and sand from the same slope, elevation, river-bank and dune weights that paint the ground. At a grounded foot contact above terrain, nearby authored rocks use stone and felled tree bases use wood. Classification happens only on contact; the nearby prop lookup is indexed. Retain water, indoor wood, snow and ice precedence. Synthetic footsteps reuse the existing bounded audio bus and mute/pause lifecycle.

Landing volume now grows with uninterrupted airtime, capped below full volume. Short steps off ledges are softer; pauses, teleports and room changes discard old airtime. No camera shake, input delay, physics or server protocol changes.
