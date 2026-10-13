# Timed overlay overlap

A timed overlay previously began fading for an entire frame when its overlap
boundary was crossed. The automatic waiting overlay was added afterward and
received no time until the next frame. Slow frames could remove the cast before
waiting gained any weight, briefly returning the arms and legs to idle.

Split each frame at the overlap boundary. Advance the incoming waiting overlay
within that same frame using only the remaining time, and charge each fade its
actual elapsed interval. Manual cancellations still fade immediately. Fishing,
reaching and other timed overlays retain their clips and existing durations.

Bone-position tests compare the cast overlap at 30, 60 and 144 FPS and one slow
frame; landing/cancellation/recasting and existing move tests remain covered.
