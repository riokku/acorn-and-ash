# HUD message priority and visible recap time

## Context

Long party lists overlapped connection details and could cover the player's
vitals. A homecoming recap could also compete with urgent combat or rescue
messages, or expire while another panel covered it.

## Decision

Keep connection status visible and put all existing diagnostic readings inside
native expandable, scrollable details. A bounded left column holds connection,
party status and vitals. The player's rescue message remains outside the nearby
player scroller; vitals reserve their actual height, including cold warnings.
Both scrollers support native keyboard navigation without moving the character.

Keep the homecoming component keyed by summary ID and mounted for the lifetime
of that summary. Defer its presentation during urgent messages, rescue, map,
storage, menus, loading and settings. Spend its 14-second budget only while it
is visible, using monotonic time. Pausing never resets that budget or dismissal.
A new summary gets a fresh budget. Game-owned summary clearing still takes
precedence, including leaving home, reconnecting and knockout.

## Consequences

Connection details take an extra click; every existing label and value remains
available. Larger parties require scrolling while self-rescue and vitals remain
visible. The recap intentionally changes from wall-clock expiry to 14 seconds
of visible reading time, so interruptions may extend its elapsed lifetime.
There are no simulation, network, reward or persistence changes.
