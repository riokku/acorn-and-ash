# 0127 — Menu transitions and keyboard routing

## Context

Central panels had independent open flags. Opening the pack or journal from the full map could leave the map covering the requested panel. Browser key repeats could toggle menus repeatedly, and gameplay keys could consume typing or a focused button's Space activation.

## Decision

Use one panel-state table for the pack, character screen, map, journal and decorating panel. Opening a panel closes the other central panels, cancels placement and closes chest storage. The character screen is the intentional exception: it opens alongside the pack (0113). Escape dismisses the current panel before clearing an interaction target. Chest replies and leaving play clear every central panel immediately.

Settings remains an overlay with its existing focus trap and Escape handler. Settings and chest storage continue to suspend gameplay; other panels retain the current walking behavior, including the full map (0054).

Text inputs, editable content, select controls, composition and browser shortcuts have priority over game keys. Native activation/navigation keys belong to focused buttons, links and sliders. Entering a text field releases held gameplay input. Menu and item taps fire on fresh presses, while held movement and actions retain their existing behavior. B is the displayed pack shortcut, with I retained as an alias.

## Consequences

Mouse buttons and hotkeys use the same central-panel transition. Switching panels cannot leave an invisible panel underneath. This is a consistency fix, without changing game simulation or imposing new modal movement rules.
