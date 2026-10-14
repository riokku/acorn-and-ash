# Buffered skeleton playback

Skeletons already use the player's animation rig, but their presentation used a fixed 100 ms clock that could run ahead of the newest snapshot. On uneven packet arrival, their position held, walking pace became zero, then their stride resumed. Packet timestamps could also jump the clock forward or leave it permanently ahead after a delay.

Give the skeleton crowd an 180 ms interpolation buffer and a separate target clock. Correct ordinary timing errors by easing playback at no more than ten percent faster or slower, always forward. Use the same clock rate for the visible gait. Keep each combat move’s start time stable across small tick-timestamp changes and fractional ages on this clock, existing clips, footing and combat effects. Other entity trackers retain their current settings.

Never extrapolate past a known position: sustained connection gaps hold the skeleton still. Teleports retain their discontinuity guard. Long clock gaps and hidden-tab rendering pauses rebase playback to recent snapshots; clearing a crowd resets its clock for reconnects.

This adds 80 ms of presentation delay compared with the former skeleton view; server combat and local player control are unchanged. The existing raider gallery has a network demo with deliberately uneven 10 Hz delivery. Unit checks cover 30/60/144 FPS, gaps, teleports and reconnects; Chrome checks the real loaded rig with the gallery's controlled frame step so software GPU throughput is not confused with network jitter.
