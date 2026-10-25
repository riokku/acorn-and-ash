# 0240 — A quiet, situated world soundscape

Birds and footsteps already have bounded transient voices, but moving water and exposed wind lack a sustained presence. Add two filtered noise voices on the existing shared sound context: water and wind. Sample the authored river and waterfall positions at 4 Hz, pan water relative to the camera, and ease gain/pan/filter changes. Waterfalls carry further than the river. Canopy softens wind; rooms attenuate and low-pass the outdoor mix, using the home's world doorway rather than indoor local coordinates. Underground darkness quiets it and frozen water silences the water layer.

Register sustained voices with the existing mute cancellation mechanism. Pause, hidden tabs, effects mute and disposal stop and disconnect every node; resume creates at most two fresh voices. No timers, network requests, new audio assets or audio contexts. Keep levels restrained so footsteps and combat remain readable. Rain and snow lengthen the existing bird scheduling intervals; rain also lowers calls.

Tests cover world anchoring, stereo, shelter/ice/tunnel attenuation, a two-voice cap, immediate mute cleanup and clean resume/disposal. Listening on physical speakers/headphones remains useful for subjective balancing.
