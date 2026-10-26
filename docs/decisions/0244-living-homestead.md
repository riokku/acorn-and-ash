# Living homestead

Projects should show their use from the path, using the actual pantry and garden state rather than decorative rewards that grant free items.

The server sends a bounded public appearance packet once per second alongside garden updates and on joining: up to 128 projects within 60 metres, nearest first. A pantry exposes only zero to five generic parcels (one per two occupied slots), never item identities or stack counts. A workbench shows its connected owner's currently equipped tool or weapon using existing cached assets; unsupported items and offline owners leave the ordinary bench fittings visible. Nearby gardens all receive their saved crops and growth, including visitors' gardens. These are presentation only; transfer, equipment and harvest rules remain authoritative and unchanged.

Existing wrapped-supply models dress the chest lid. Dressing hides while the lid is open. Tool geometry and materials remain owned by the item caches. Garden scales progress continuously from 22% to 100% across the existing ten-minute awake-world growth period, for indoor and outdoor beds alike. No extra persistence is needed: pantry slots and garden timers already survive reloads. Tools follow live equipment, rather than storing copies of inventory items.

The new packet appends a message ID without changing existing layouts. Decoding checks lengths, caps, duplicate IDs, crops, growth and item indices. The gallery offers an empty and stocked version for visual review. No new art assets or material families are introduced.
