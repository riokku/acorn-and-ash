# 0068. Mouse looting and a quieter HUD

**Status:** accepted · **Date:** 2026-10-02

## Context

Chris asked to move the always-visible controls into Settings > Keybindings and
make world items right-clickable. He also approved hover feedback, clear pickup
failures, quieter exploration prompts, and useful inventory descriptions.

## Decision

Settings contains General and Keybindings tabs, available from Home and the
paused game. Keybindings is a reference for the current fixed controls. Contextual
prompts remain for nearby actions and danger; idle movement and build reminders
are removed. Inventory tooltips explain uses and show why pinned but absent items
cannot be used. The nearby E interaction remains available.

A short right-button tap raycasts the visible loot under the cursor; dragging
still turns the camera, and placement still claims a tap to cancel. Inventory
right-clicks keep their drop/destroy menus. Hovering loot shows its name, quantity,
and reach or pack restrictions and highlights that object. Solid scenery blocks
clicks. Picking a patch gathers one item; picking a pile takes as much as fits.

The four-byte Loot request carries a target kind and ID. The server consumes one
queued request on its next tick, checking the player's current location, outdoor
space, action, health, availability, inventory, and gathering cooldown. The request
never falls back to another object, campfire, or eating food. Queued loot is cleared
when control transfers to another connection.

## Consequences

Matching client and server versions are required for the new message. Mouse taps
preserve their original cursor position and cannot become attacks. Releasing or
blurring cancels pending gestures, including delayed pointer capture. Keyboard
interaction retains its existing priority and holding behavior.
