# Assets

Blender source files (`.blend`), the models and textures exported from them, and
anything else that ends up in the game or in R2 lives here, in a folder per kind
of thing (`trees/`, `characters/`, `buildables/` and so on). New and replacement
art is made in Blender through the Blender MCP; see "Making art with Blender" in
the root `CLAUDE.md` and `docs/decisions/0105-art-is-made-in-blender.md`.

**Every file in this folder needs a row in `LICENSES.csv`.** The pull request
check fails without one, and the in-game credits page is generated from that
file. That includes the `.blend` source and the exported `.glb`, as two rows.
The columns are:

| Column          | What goes in it                                                                                         |
| --------------- | ------------------------------------------------------------------------------------------------------- |
| `file`          | Path relative to the repository root, e.g. `assets/trees/pine.blend`                                    |
| `source_url`    | Where it came from. `original` for our own work                                                         |
| `author`        | Who made it. `Acorn & Ash` for our own work                                                             |
| `license`       | e.g. `CC0-1.0`, `CC BY 4.0`, `All rights reserved (original)`                                           |
| `date_added`    | `YYYY-MM-DD`                                                                                            |
| `modifications` | What we changed, or `none`. For our own work: "Modelled in Blender with Claude through the Blender MCP" |
| `ai_tool`       | `Meshy`, `Tripo`, `Hyper3D Rodin`, `OpenAI`, or empty when no AI generator was involved                 |
| `ai_plan`       | `paid` or `free`, or empty                                                                              |

Allowed sources:

- Our own work, modelled in Blender.
- CC0 packs (Quaternius, KayKit, Kenney).
- Poly Haven (CC0).
- Sketchfab, for models licensed CC0 or CC BY only. Never NonCommercial,
  NoDerivatives or anything unclear. Record the model's page, author and licence.
- Meshy, on a paid plan or on the free plan with a CC BY 4.0 credit.
- Tripo, on a paid plan only.
- Hyper3D Rodin, on a paid plan only (the check enforces this) until the free
  plan's terms have been checked.

The user-requested loading illustration uses OpenAI image generation, recorded
under the OpenAI Terms of Use.

Not allowed: Hunyuan3D (including its button in the Blender MCP), or anything
whose terms are unclear. This repository is public, so never commit source files
whose license forbids redistribution. Keep `.blend` files small, a few MB:
bake or drop heavy textures, because a file bigger than 25 MiB can't be served as
a static asset anyway.

Size limits per model: player 10k triangles, animals 5k, trees 4k (with distance
versions), props 2k.
