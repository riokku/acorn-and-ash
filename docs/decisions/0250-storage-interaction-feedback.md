# Storage interaction feedback

Opening or moving items in storage now reports whether the command was submitted, waits for the authoritative reply, and gives a connection hint after eight seconds. Offline commands are never queued or replayed. No timeout retries a transfer.

Closing storage dismisses the UI, not a command already in flight. That command continues to block another storage request until its reply arrives; a late reply shows its result without reopening the panel. Leaving the connection clears that pending state, since the old socket cannot deliver into the replacement connection. Other gameplay and menus remain available after dismissal.

Fire and log-storage controls also explain common disabled states: disconnected, no fuel, full fire or no pack space. These are presentation hints; all transfers, reach, ownership and fuel checks remain on the server.
