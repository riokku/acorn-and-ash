# Protected owner world resets

Chris requested a protected administrator control for a full fresh start of one world, preserving accounts and the site-wide item catalogue.

Admin → Worlds reuses the existing verified Google owner gate (`ADMIN_OWNER_EMAIL`) on HTML and every admin API. Mutation requests require same-origin JSON with a bounded body. The web Worker supplies the verified actor and site to World RPC; no reset command is exposed through game HTTP or WebSockets. The old unauthenticated `reset-players` URL and handler are removed.

Resets require an empty world, an explicit review, acknowledgement and exact `RESET <world-id>` text. The server issues a two-minute one-use proof bound to actor, origin and world. A new WebSocket connection cancels it; the final operation checks occupancy and proof again synchronously. A transaction clears application world tables and progress metadata while preserving seed, the staging migration marker, cached catalogue and a separate reset audit. Accounts and the authoritative item catalogue live in different stores. The same seed recreates the baseline map, and the normal site calendar continues.

Reset generations persist separately and tag connections. Stale socket messages/close events cannot restore old players after a reset. Timers, simulation and transient caches are released. Audit history records time, actor and prior character/build counts. Unknown results are not automatically retried; the UI asks the owner to refresh status/history. Empty worlds retain hibernation; no polling or scheduler is introduced.

Browser tests use an isolated preview API. Worker tests verify real owner authorization and reset effects in isolated worlds, including stale proofs, connections, other-world isolation and catalogue preservation. Automatic rolling resets and forced disconnection are future features, not enabled here.
