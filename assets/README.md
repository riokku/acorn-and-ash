# Assets

Blender source files and anything else that ends up in the game or in R2 lives
here.

**Every file in this folder needs a row in `LICENSES.csv`.** The pull request
check fails without one, and the in-game credits page is generated from that
file. The columns are:

| Column | What goes in it |
| --- | --- |
| `file` | Path relative to the repository root, e.g. `assets/trees/pine.blend` |
| `source_url` | Where it came from |
| `author` | Who made it |
| `license` | e.g. `CC0-1.0`, `CC BY 4.0` |
| `date_added` | `YYYY-MM-DD` |
| `modifications` | What we changed, or `none` |
| `ai_tool` | `Meshy`, `Tripo`, or empty when no AI tool was involved |
| `ai_plan` | `paid` or `free`, or empty |

Allowed sources: CC0 packs (Quaternius, KayKit, Kenney); Meshy on a paid plan,
or on the free plan with a CC BY 4.0 credit; Tripo on a paid plan only.

Not allowed: Hunyuan3D, or anything whose terms are unclear. This repository is
public, so never commit source files whose license forbids redistribution.

Phase 0 draws everything with placeholder shapes, so this folder is empty apart
from these notes.
