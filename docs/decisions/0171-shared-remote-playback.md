# Shared remote playback

Other players and wildlife still used the fixed 100 ms clock after skeletons gained buffered playback. Uneven packet delivery could exhaust their history, stopping the body and gait between otherwise regular server ticks.

All snapshot-controlled actors now use one factory with the existing skeleton policy: 180 ms of presentation delay, forward-only eased clock correction, stable action origins and no extrapolation beyond known positions. The local player's prediction and all authoritative combat rules remain unchanged. This adds 80 ms of visual delay for remote players and animals.

A new connection or room transition clears the actor histories and clocks together, including skeletons. The existing moves gallery offers a network demo with the actual player and elk models, using the gameplay factory and controlled packet jitter. Tests cover continuous travel at 30/60/144 FPS, stopped delivery, and actual browser rig motion.
