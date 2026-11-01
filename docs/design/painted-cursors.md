# Painted pointer and loot cursor

The default pointer now uses cream, dark fir and copper in the painted icons'
style. Hovering world loot or a chest shows a matching leather loot pouch with
a small pointer tip. Both static transparent PNGs use the same 3,3 hotspot;
the normal cursor is 32 pixels and the loot cursor is 40 pixels. Together the
images are under 5 KB. Native cursor fallbacks remain available.

The loot cursor follows the existing hover target, including its visibility,
occlusion, menu and pointer-lock conditions. It identifies a loot target; the
existing tooltip still explains distance or other refusals. Text fields,
buttons, disabled controls and dragging retain their native cursor rules.
The implementation uses browser cursors without a DOM follower or animation.

Open `/?gallery=cursors` to inspect both images at actual size on light and
dark surfaces, and hover the sample areas to try the native cursors. Gallery
screenshots show the artwork, not a captured operating-system cursor.

Before this pass the game used the system default pointer and native hand for
loot targets. The [native-size review](../previews/painted-cursors/native-size-gallery.png)
shows the new artwork on parchment and fir. Astra approved the contrast, shape
and runtime changes.

Validation passed: 12 loot-target tests, client and browser-test TypeScript,
changed-file lint/formatting, asset licenses and the client build. Existing
chest and discovery browser cases passed with cursor-mode assertions, including
the normal cursor after opening the chest. The gallery checked image decoding,
shared hotspots, fallbacks, and native text, enabled-button and disabled-button
cursors. The browser cases use a local simulation and controlled session
responses; they do not certify online persistence or every operating system's
cursor display.

The cursor art was generated with OpenAI image generation, using the approved
painted icon style. Mechanical exports trim visible bounds and downsample the
artwork to cursor size. The license ledger records both files.
