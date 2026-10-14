# Camera recovery through short gaps

With immediate pull-in and immediate eased recovery, a two-frame clear gap between blockers at 60 FPS pushed the camera 32 cm outward before it snapped back at the next trunk. Repeated small gaps could pump the view in a dense forest.

Keep immediate pull-in and all centre/near-plane/shake safety probes. Require 100 ms of continuous clearance before easing outward. Split frames across that grace period so recovery remains independent of frame rate, including a slow frame. Re-obstruction or a shake correction resets the grace period; entering/leaving a home resets the distance state along with the existing framing.

A real-triangle regression fails on the old code and holds a steady view over repeated two-frame gaps with this change. Existing 30/60/144 FPS and slow-frame recovery comparisons, slopes, wide-screen grazing corners and shake safety remain. The only tradeoff is 100 ms before outward recovery starts after an obstacle clears.

Camera updates also publish their final matrices immediately. `lookAt` changes the quaternion after its internal world-matrix update, so a zero-time update used by cursor input left the picking ray facing the previous view until rendering. A regression reproduces a roughly 45-degree mismatch after a turn; synchronizing once at the end makes the ray match the current target before any renderer update.
