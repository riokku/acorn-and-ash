# Offline retries preserve navigation

Connection retries alternate between connecting and offline while gameplay is
already paused. Clearing controls on every transition could discard a journal
key or a fresh placement click before the next frame, leaving no refusal feedback.

Clear controls and predicted motion only when entering or leaving a confirmed
connection. Offline frames still suppress movement and reject gameplay requests;
reconnection still clears held controls so old actions cannot resume.

Validation uses the existing browser scenario for offline crafting, blueprint
use, tent placement and fresh-only actions after reconnecting, alongside both
closed-socket and silent-socket held-movement recovery scenarios.
