# 0105 · New art is made in Blender, through the Blender MCP

## Context

Until now the game's own art has come from two places: free CC0 packs converted with `tools/import-model.mjs`, and shapes and textures drawn in code while the world loads (decision 0053, which chose code over image files and online libraries). That got the game looking cohesive quickly, but code-drawn shapes can only go so far, and Chris wants better graphics.

Chris now has the Blender MCP set up, which lets Claude see and edit a live Blender scene and take screenshots of it. It also has built-in buttons for Poly Haven, Sketchfab, Hyper3D Rodin and Hunyuan3D. Our asset rules allowed none of the first three by name and ban the last.

## Decision

- **Blender is where new and replacement models and textures are made.** One asset family per pull request, only once its mechanic is fun, as before. Existing code-drawn art stays until its family is replaced; this partly supersedes 0053's "textures drawn by code" for new work.
- **Art sessions run on Chris's computer**, where Blender is. Cloud sessions can't reach it, and are told to say so and keep placeholders rather than fake art.
- **A fixed loop** (written out in `CLAUDE.md`): look at the existing family and the Quaternius pack, build to scale at the base origin, look at screenshots and iterate, check the triangle budget, save the `.blend` and export glTF, run `tools/import-model.mjs`, add licence rows, check in the game and gallery, open a pull request with before and after pictures.
- **Sources.** Chris approved Poly Haven, Sketchfab and Hyper3D Rodin. Poly Haven is CC0, so it joins the allowed list. Sketchfab is limited to CC0 and CC BY models, because other licences forbid commercial use or changes. Rodin is allowed on a paid plan only for now, which `tools/check-asset-licenses.mjs` enforces, until its free-plan terms have been read. Hunyuan3D stays banned, including its button in the Blender MCP.
- **Licence rows for our own work:** `source_url` `original`, `author` `Acorn & Ash`, `license` `All rights reserved (original)`, `ai_tool` empty, and `modifications` saying it was modelled in Blender with Claude through the MCP. `.blend` sources are committed alongside the exports and each gets a row.
- **Safe use.** Python run inside Blender runs on Chris's computer, so scripts only build or edit the scene or export into `assets/`, and the Sketchfab and Hyper3D keys stay in Blender's settings, never in this public repo.

## Consequences

- The licence check now accepts `Hyper3D Rodin`, and rejects it without `ai_plan` `paid`.
- The default licence wording for original work, and leaving `ai_tool` empty for work Claude modelled by hand, are defaults. Chris can change either, and a later pull request would update the rows and the rules together.
- Downloaded and AI-generated models usually come in far over budget, so cleaning them up is part of the job, not an extra.
- `.blend` files make the repository bigger. They are kept to a few MB by baking or dropping heavy textures.
- Nothing in the game changes in this pull request. It only changes the instructions and the licence check.
