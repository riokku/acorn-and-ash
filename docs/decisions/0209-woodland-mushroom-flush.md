# 0209 — A discoverable woodland mushroom flush

Exploration benefits from occasional changes at familiar places. The first world
event is a shared mushroom flush around the camp or grove on days 2 and 5 of
spring and autumn. It lasts a full game day and awards ordinary cooking supplies.
There is no countdown, exclusive item, or account-specific reward.

The server selects a landmark and up to three clear, gently sloped positions using
seeded randomness. Existing mushroom models, gathering packets, inventory rules
and patch persistence are reused. Reserved IDs 240–242 follow the mountain patches.
For these IDs, the saved generation records the absolute calendar day of the last
flush. Gathering, expiry and construction can empty clusters; normal regrowth and
reconnection cannot refill them. Missing clear spots stay empty for that flush.

A nearby hint depends on the actual replicated harvest remaining, rather than a
client-side schedule. The event calendar uses persisted simulation time so it
pauses with an empty world. Placement work runs only when the calendar day changes.
