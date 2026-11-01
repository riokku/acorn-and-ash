# Field journal home controls

Object management, chest storage and the door-lock strip now share the journal's
parchment, fir binding, restrained corners and copper focus marks. Object names
use the existing painted buildable art. Storage wells and quantity badges match
the pack, while dismantling keeps a distinct brick-red treatment.

The object panel's header stays visible and its contents can scroll within the
viewport. This keeps the longer cabin confirmation reachable in a short window.
Move, pack up, dismantle, refunds, ownership, pending states and the exact
`DISMANTLE` confirmation retain their existing behavior. The panel remains a
nonmodal overlay with its original layer and Escape handling.

## Review

These matched captures use the actual React HUD and components over a fixed
game frame with sample state. They cover owned movable and dismantle-only
objects, foreign ownership, pending actions, home prerequisites and confirmation,
populated/empty/pending storage, tooltips, keyboard focus and door privacy states.
They do not exercise online authentication or persistence, or measure frame rate.

| View                            | Before                                                                            | After                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Object management               | [Before](../previews/field-journal-home-controls/before-object-movable.webp)      | [After](../previews/field-journal-home-controls/after-object-movable.webp)      |
| Chest storage                   | [Before](../previews/field-journal-home-controls/before-chest-populated.webp)     | [After](../previews/field-journal-home-controls/after-chest-populated.webp)     |
| Cabin confirmation at 900 × 600 | [Before](../previews/field-journal-home-controls/before-home-confirm-narrow.webp) | [After](../previews/field-journal-home-controls/after-home-confirm-narrow.webp) |
| Door controls                   | [Before](../previews/field-journal-home-controls/before-door-unlocked.webp)       | [After](../previews/field-journal-home-controls/after-door-unlocked.webp)       |

Additional checks: [typed confirmation](../previews/field-journal-home-controls/after-home-confirm-typed.webp),
[foreign ownership](../previews/field-journal-home-controls/after-object-foreign.webp),
[pending object](../previews/field-journal-home-controls/after-object-pending.webp),
[empty chest](../previews/field-journal-home-controls/after-chest-empty.webp),
[pending chest](../previews/field-journal-home-controls/after-chest-pending.webp),
[focused item tooltip](../previews/field-journal-home-controls/after-chest-tooltip.webp), and
[door focus](../previews/field-journal-home-controls/after-door-focus.webp).

Controlled browser checks verified exact typed confirmation, Cancel without a
request, Escape, pending and ownership restrictions, keyboard Move/Lock actions,
Shift-click transferring one, chest focus cycling and closing while pending.
Astra approved the final code and rendered results. Documentation screenshots
use quality-92 WebP; no new runtime assets or effects are required.

Client and browser-test TypeScript, changed-file lint/formatting, diff checks
and the client build passed. The existing storage-chest and placed-object
browser cases also passed against a local simulation with controlled session
responses, including confirmation before reclaiming and Cancel sending no
request.
