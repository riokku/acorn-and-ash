# Seasonal torch ignition

Torch swings can deliberately ignite a standing tree using the existing server-owned
attack impact and tree reach/facing rules. Carrying a torch or brushing past a tree
does not start a fire. Skeleton combat keeps priority over scenery.

Winter blocks ignition. Spring and autumn fires burn only their initial tree;
summer ignitions use the same spread, damage, burnout and limits as lightning
(a spread attempt after 12 seconds, neighbours within 5 metres, at most three
generations and 32 simultaneous fires). Fire can still damage nearby players.

Contained fires start with their existing `spread` flag consumed, so save/restore
cannot accidentally turn them into wildfires. When summer ends, active fires
also consume their spread opportunity and finish burning in place. This keeps
existing saves and the multiplayer fire message format compatible.

The HUD explains the seasonal rule when facing a tree with a torch equipped.
