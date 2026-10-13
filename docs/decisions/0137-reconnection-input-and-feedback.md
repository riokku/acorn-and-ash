# Reconnection waits for the player

## Context

An open socket previously counted as connected before the server supplied the returning player's position. Predicted walking and queued input could continue during an outage, making reconnection appear to undo the player's travel. A rejected connection could also enter an automatic retry loop.

## Decision

Keep gameplay paused until a welcome and a snapshot containing the local player arrive. Apply that snapshot before announcing connected. Clear held buttons, predicted input, transient movement events and smoothing when connection state changes; only newly pressed input resumes play. Discard input sent while disconnected or still joining. Keep a persistent HUD notice while actions are paused.

Allow identity and ping messages during the handshake. Give an incomplete handshake 30 seconds before the normal delayed retry. A server rejection stops automatic retries and stays visible with a manual reload option. Development-only offline walking remains available for art work; deployed clients wait for the real world.

## Consequences

Reconnection is explicit and returns to authoritative state before movement starts. This changes no server movement or survival rules: the world continues during an outage, and already submitted actions still need their existing confirmation or interruption handling. A held key must be released and pressed again after reconnecting.
