# Field journal gameplay feedback

Contextual guidance now uses quiet fir strips, while gain receipts and the
full-pack action use the field journal's paper and binding. Amber urgency and
red placement refusal keep their existing meanings. The pickup action, item
icons, message text and timing remain unchanged.

Messages that can appear together share a content-sized stack above the hotbar.
This keeps the ordinary hint at its former height while allowing additional
messages to sit above it. Gain receipts stay at the right edge and wrap within
available space. The loot tooltip clamps using its rendered size.

## Review

These controlled states use the production React HUD over a frozen game frame;
they are not an online playthrough. The before capture shows a simultaneous
hint, news, pickup refusal and interaction note overlapping. The matched after
capture shows all four messages separately. The fixture also checked gathering,
multiple gains, craft guidance, valid and blocked placement, fishing, low health,
long loot text, reduced motion, and the pickup button's focus and activation.
It checked bounds and separation from the hotbar and vitals at 900×600,
1366×768 and 1920×1080.

Astra approved the final code and rendered results, including long narrow-window
prompts and the original message layers over menus. Client TypeScript, changed
file lint/format checks, the client build and 13 focused feedback tests passed.
The existing action-feedback and craft-feedback browser cases also passed with
a local simulation and controlled session responses: reconnect/build behavior,
craft confirmation, duplicate-click prevention and authoritative refusals.

| View                     | Capture                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| Combined messages before | [Before](../previews/field-journal-feedback/before-combined.png)   |
| Combined messages after  | [After](../previews/field-journal-feedback/after-combined.png)     |
| Narrow window            | [900×600](../previews/field-journal-feedback/after-narrow.png)     |
| Blocked placement        | [Blocked](../previews/field-journal-feedback/after-blocked.png)    |
| Fishing bite at night    | [Night](../previews/field-journal-feedback/after-night-biting.png) |

A [long blocked hint at 900×600](../previews/field-journal-feedback/after-narrow-blocked.png) wraps clear of the vitals. Settings and chest overlays were also checked over live guidance; the inventory still hides the hint and pickup action.
