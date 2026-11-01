# Field journal entry and settings

The entry screens and settings carry the approved field journal's warm paper,
fir binding and copper selection marks through to the start of the game. The
painted valley, title, character stage and provider button colors remain. The
six body choices, account actions and settings controls retain their behavior.
Settings can scroll on short windows, and entry controls have visible keyboard
focus marks.

## Review

These captures show the actual React entry and settings components in a
standalone fixture with a sample account and sign-in choices. The character
stage renders in Chromium with WebGL. They do not exercise online sign-in or
world routing. Astra approved the captured treatment.

| View            | Before                                                        | After                                                       |
| --------------- | ------------------------------------------------------------- | ----------------------------------------------------------- |
| Title           | [Before](../previews/field-journal-entry/before-front.png)    | [After](../previews/field-journal-entry/after-front.png)    |
| Sign-in choices | [Before](../previews/field-journal-entry/before-choices.png)  | [After](../previews/field-journal-entry/after-choices.png)  |
| Character entry | [Before](../previews/field-journal-entry/before-home.png)     | [After](../previews/field-journal-entry/after-home.png)     |
| Settings        | [Before](../previews/field-journal-entry/before-settings.png) | [After](../previews/field-journal-entry/after-settings.png) |

The [900×600 settings view](../previews/field-journal-entry/after-narrow-settings.png)
shows the short-window layout. In the fixture, Enter World remained reachable
by scrolling and keyboard at 1366×768 and 900×600. The settings dialog closed
with Escape and returned focus to its button.
