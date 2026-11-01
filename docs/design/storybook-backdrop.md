# Storybook entry landscape

The shared title, sign-in, character-entry and loading landscape now uses the
painted icons' dimensional cartoon style. Chunky evergreen tiers, broad rock
planes, warm timber and a welcoming cabin keep the same mountain-lake setting,
with a quiet central valley for the interface.

The image remains 1672 × 941 pixels and is encoded as a 293 KB WebP. The cabin
smoke, window glow and reflected light were re-anchored to the new painting.
The existing seasonal grading, lake detection, motion pacing and reduced-motion
behavior remain. The lake detector finds 4,982 candidate points; sampled banks,
cabin and sky remain outside its ice mask.

Open `/?gallery=backdrop` to inspect the actual shared painting, then select a
season. The gallery uses the production backdrop and its effects.

## Review

Matched before/after captures use the actual React entry and loading components
with controlled sample state and a fixed calendar. They cover title, sign-in
choices, character, loading, retry and trouble screens at 1366 × 768,
1920 × 1080 and 900 × 600, plus four seasons with normal and reduced motion.
They do not exercise online sign-in or world routing, or measure game frame rate.

Astra approved the illustration and rendered layouts after the cabin-window
anchor correction. The 52 backdrop/season/pacing tests, TypeScript, lint,
formatting, asset licenses and client build passed. The production backdrop
gallery passed all four seasonal views, normal-motion changes and reduced-motion
stillness without page errors.

| View    | Before                                                       | After                                                      |
| ------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| Title   | [Before](../previews/storybook-backdrop/before-title.webp)   | [After](../previews/storybook-backdrop/after-title.webp)   |
| Loading | [Before](../previews/storybook-backdrop/before-loading.webp) | [After](../previews/storybook-backdrop/after-loading.webp) |

Additional views: [narrow character entry](../previews/storybook-backdrop/after-character-narrow.webp),
[narrow retry](../previews/storybook-backdrop/after-error-narrow.webp),
[spring](../previews/storybook-backdrop/after-spring.webp),
[autumn](../previews/storybook-backdrop/after-autumn.webp), and
[winter](../previews/storybook-backdrop/after-winter.webp).

The illustration was generated with OpenAI image generation using the previous
landscape and approved shelter icons as references. Its source is recorded in
`assets/LICENSES.csv`; no additional model, font or runtime effect is required.
