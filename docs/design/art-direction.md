# Acorn & Ash: working art direction

Status: working brief, grounded in the existing game and subject to gameplay-distance review. This is a visual and experiential direction, not a new feature roadmap.

## Promise

**A welcoming wilderness built over something ancient.**

The player should want to leave a small, cared-for home, find something in the forest that predates them, survive a readable encounter, and bring a little of that world home. The setting suggests the Pacific Northwest through evergreen scale, cool air, damp stone and timber. It remains a stylized, friendly world rather than a realistic regional simulation.

## The four beats

| Beat               | Desired feeling                         | What should lead the eye                                                       |
| ------------------ | --------------------------------------- | ------------------------------------------------------------------------------ |
| Cabin              | Belonging and readiness                 | Doorway, useful possessions, and earned warmth                                 |
| Forest             | Curiosity and sheltering scale          | A traversable opening framed by larger tree masses                             |
| Skeleton encounter | An old presence becoming a clear threat | Body silhouette, weapon preparation, then the attack cue                       |
| Home again         | Relief and ownership                    | The recognizable home, its working fire, and the finds the player brought back |

Existing controls, survival, construction, outings, equipment and rewards carry these beats. Art should clarify them without inserting another objective, popup, or compulsory pause.

## Visual grammar

- **Shape:** broad, readable low-poly masses; softened timber and foliage at home; taller framing trunks in the forest; broken, deliberate stone shapes for old places. Preserve the Quaternius-compatible scale and silhouette language.
- **Value:** the near playable ground and actors remain readable. Separate the middle-distance forest from the far atmosphere. Save the strongest small contrast for an interaction or danger; do not make every leaf or pebble equally insistent.
- **Color:** fir green for living structure, slate blue for air and shaded distance, amber for working warmth, weathered copper for restrained crafted accents. These are roles, not a universal tint. Bone, skin, food, cloth and safety indicators must keep their useful identities. Exact swatches await matched scene review.
- **Material:** timber should feel cut and assembled, stone settled and weathered, metal sparse and useful. Broad material divisions should survive at normal camera distance before tiny surface detail is added.
- **Composition:** make home recognizable through silhouette and useful focal points. Use existing paths, openings and landmark framing to invite exploration. Do not relocate saved scenery or alter traversability for a screenshot.
- **Motifs:** pitched timber and exposed growth rings can quietly connect home to the forest; broken stone openings can mark the older world. Treat these as restrained hypotheses drawn from existing forms, not a requirement for new assets or decoration on every surface.
- **Light and weather:** clear days can be welcoming without making every surface yellow-green. Cloud cover should soften light while retaining layers and threat legibility. Night should feel cool, with local warmth where an actual fire burns, while retaining the established visibility floor.

## Movement, sound and interface

Grounded foot contact, dependable camera clearance and distinct preparation/recovery poses matter more than decorative motion. Camera control stays with the player. Keep nonessential panel and decorative transitions brief and softly eased; threat timing remains explicit. Weather and particles should never obscure a wind-up or suggest damage where there is none. Honor reduced-motion preferences by reducing decorative movement and shake without hiding necessary feedback.

The soundscape should support the route: close footsteps and working fire, wider birds and water, a quieter bed beneath encounter cues, then shelter on return. The code already supplies much of this behavior; its quality must be judged by listening, not source inspection.

Treat the interface as a field journal around the world. Keep the existing Fraunces headings, with Georgia as fallback, and system sans-serif for functional labels, numbers and instructions. Use quiet hierarchy during travel, explicit guidance during interaction and unmistakable status during danger. Preserve the meaning of existing targeting and warning colors. Keep the view ahead clear; new feedback must earn its screen space.

## Production boundaries

Chris explicitly authorized a non-Blender model and material pass for this work, overriding the Blender-only process in `CLAUDE.md`. That exception permits an appropriate non-Blender workflow; it does not relax licensing, redistribution or asset budgets. Judge any replacement beside the existing Quaternius-compatible assets at gameplay distance before accepting it.

The first lighting trial reused current assets but did not produce a convincing improvement. Route review has since shown the camera entering evergreen foliage. The accepted first improvement adds canopy clearance while preserving the trees and existing camera controls; broad off-center branches can still obscure part of the view. Keep the first shipped change focused on the problem that the evidence supports. Broader model, material, terrain or interface work remains available when observed evidence justifies it. Preserve player/animal/tree/prop triangle limits (10k/5k/4k/2k), instancing, distance meshes, bounded effects, fixed light pools, online authority and persistent world identifiers. Record any new shipped asset in `assets/LICENSES.csv`. Do not change controls, progression or combat rules to satisfy the art direction.

## Review standard

Judge matched captures at the ordinary third-person gameplay camera before gallery close-ups. Cover cabin departure, a forest crossing, a skeleton wind-up and return home, in daylight, night and representative adverse weather. Lock seed, position, camera, time, season and weather for before/after pairs. An improvement must strengthen one of the four beats without weakening actor visibility, material identity, camera behavior or weather readability. Record what was actually seen, what was inspected in code, and what remains a hypothesis separately.
