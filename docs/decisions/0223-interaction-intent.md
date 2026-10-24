# Reliable pickup intent and honest prompts

A click arriving just before an action or gather cooldown ended was discarded.
Explicit pickup requests now keep their original target for at most 250 ms while
waiting for the player to become free. The latest click replaces the previous
one. Execution still checks reach, terrain, inventory and availability; an invalid
or expired target never falls through to collecting something else. Reconnecting,
changing space and a knockout clear the pending intent. There are no extra timers
or protocol fields.

Holding E still gathers repeatedly, but eating requires a fresh press. Emptying a
patch cannot consume a held meal on subsequent held-input ticks. Prompts now match
inspection, loot and cooking priority before suggesting food; deliberate menus
retain their instructions even when hungry. Survey requirements are displayed
without wrapping them in a misleading “inspect” sentence. An inspection target
suppresses the gathering glow because it owns E. Mineral and forage confirmations
use restrained material-specific sounds through the existing effects mixer.
