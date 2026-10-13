# Camera easing by elapsed time

Camera pull-out and fishing tilt used a linear, per-frame fraction clamped to
one. Their response depended on frame rate, and a slow frame could jump directly
to the destination.

Use exponential elapsed-time easing with the existing response rates. Collision
pull-in remains immediate. Deliberate upward mouse movement still cancels a
fishing tilt. Indoor framing, distance and pitch limits are unchanged.

Tests compare equal elapsed time at 30, 60 and 144 FPS and with long frames,
including the player's cancellation of a tilt.
