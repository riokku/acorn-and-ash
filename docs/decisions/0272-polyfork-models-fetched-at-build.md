# Polyfork models, fetched at build

## Context

Chris compared ten of our models with the free low-poly models at
[Polyfork](https://polyfork.dev) and chose to use these Polyfork models as
they are: the canoe, rabbit, tent, garden lantern, fence, tree stump,
mushrooms and berry bush, Roosevelt elk (their deer), cabin, and the cedar
bench and timber table.

Polyfork's licence allows commercial use with no attribution, and a game may
ship the models inside it. It forbids redistributing the files themselves,
and this repo is public, so committing them to `assets/` would put
downloadable copies on GitHub. Making the repo private was considered and
rejected. A pull request uses about 150 minutes of GitHub Actions time, and
there were about 78 of them last month. A private repo on the free plan gets
about 2,000 minutes a month.

## Decision

- **Never commit the files.** `tools/polyfork-models.json` lists each model
  by its Polyfork id and the name the game loads it by.
  `tools/fetch-polyfork.mjs` downloads them from Polyfork's CDN, compresses
  them with `import-model.mjs`, and writes them into
  `apps/client/public/polyfork/`, which git ignores. The client's `dev` and
  `build` scripts run it first, so local play, browser tests, previews and
  deploys all get the files without anyone running anything by hand.
- **Fail soft.** A model that can't be downloaded only gives a warning. Every
  Polyfork model keeps the placeholder shape it replaces, and the game draws
  that placeholder until the file is there.
- **Used as they are.** These are not remodelled in Blender. The game fits
  each one in code: its scale, which way it faces and where it sits, so the
  rules the old shape was tuned for still hold.
- **One family per pull request**, as with other art. The canoe goes first
  and brings in the download step.
- **No licence rows.** The files are not under `assets/` or in R2, and
  Polyfork asks for no credit. The manifest records each model's page.

## Consequences

- A build needs to reach polyfork.dev. If Polyfork is down, that build ships
  placeholders for the models it couldn't fetch. Rebuilding fixes it.
- If Polyfork changes a model on its CDN, the next fresh build picks the
  change up. Locally, `node tools/fetch-polyfork.mjs --refresh` fetches them
  all again.
- Polyfork models are flat vertex colours, and most of our own art is
  painted. Chris accepted that difference after seeing them side by side.
- This is an exception to "art is made in Blender" (decision 0105) for the
  models Chris chose, not a new default.
