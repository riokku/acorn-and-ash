# Field journal illustrations

Seven painted landmark and creature vignettes now appear as discoveries are
found. Unknown entries retain their original faint ink sketches. Their titles,
clues, notes, progress and claimed statuses keep the same wording and order.
Claimed-only flags never reveal an illustration.

The art follows the current landmarks and woodland creatures: a weathered
bedroll and cairn, old timber, mushrooms beneath a fallen branch, a low offering
stone, a Roosevelt elk, a masked raccoon and the mossy branch-crowned guardian.
Blank notes, bowls and closed boxes are existing landmark props; illustrations
show no reward contents, exact approaches or route information.

Garden headings and actions reuse the painted crop icons. Existing growing and
harvest text provides the state, with the same quantities and restrictions.
Completed woodland stories gain a common trail-pennant mark beside the existing
check and text. Unknown stories keep their diamonds. The pennant celebrates the
remembered story without claiming an unrecorded historical reward variant.

The seven transparent 156 × 128 images total about 81 kB and render in the existing
78 × 64 slot. They add no animation or layout layer. Artwork and source credits
are recorded in assets/LICENSES.csv. See
[decision 0276](../decisions/0276-discovered-journal-illustrations.md).

## Rendered review

Matched captures use the actual journal React components with controlled sample
state over a fixed game frame. They verify presentation and local actions,
rather than online authentication or persistence. Documentation images use
quality-92 WebP.

| View                            | Before                                                                                  | After                                                                                 |
| ------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Discovered landmarks            | [Before](../previews/journal-illustrations/before-discoveries-found-wide.webp)          | [After](../previews/journal-illustrations/after-discoveries-found-wide.webp)          |
| Woodland creatures at 900 × 600 | [Before](../previews/journal-illustrations/before-discoveries-found-narrow-bottom.webp) | [After](../previews/journal-illustrations/after-discoveries-found-narrow-bottom.webp) |
| Garden actions                  | [Before](../previews/journal-illustrations/before-garden-mixed-wide.webp)               | [After](../previews/journal-illustrations/after-garden-mixed-wide.webp)               |
| Remembered stories              | [Before](../previews/journal-illustrations/before-stories-claimed-narrow.webp)          | [After](../previews/journal-illustrations/after-stories-claimed-narrow.webp)          |

Additional views: [mixed discovery progress](../previews/journal-illustrations/after-discoveries-mixed-wide.webp),
[unknown entries](../previews/journal-illustrations/after-discoveries-unknown-wide.webp), and
[keyboard keepsake action](../previews/journal-illustrations/after-stories-focus-narrow.webp).

Open `/?gallery=journal-art` for a read-only preview of the real components.
Choose `view=discoveries`, `garden` or `stories`, and `state=unknown`, `mixed`,
`found` or `claimed` to compare the sample states. This does not change a world.

## Verification

Controlled component checks passed at 1366 × 768 and 900 × 600 for exact
text parity, zero colored art in unknown/claimed-only entries, mixed and all
found states, and scrolling to the final guardian entry. Garden checks cover
plant/harvest requests, keyboard action, ownership, distance, empty inventory
and full-pack feedback. Story checks cover no/one/all memories, the keepsake
callback and focus inside the production homestead layout. The three public
gallery views also passed.

All 14 targeted unit checks passed, including eight illustration reveal/privacy
cases. Scoped lint, client and browser-test types, formatting, asset licensing,
diff checks and the client build passed. The built-game discovery regression also passed: it records a found place,
inspects the personal reward and crafts the learned recipe through the journal.
