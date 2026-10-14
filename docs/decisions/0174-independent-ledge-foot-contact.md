# Independent foot contact at ledges

The foot solver discarded the whole pose as soon as either foot sampled a drop over 18 cm. A foot still on a gentle slope could then sink into the terrain, while both feet and the pelvis lost their correction in one frame. Two regressions reproduce both defects on the old code.

Each foot now tracks its own supported height, normal and contact weight. An unsupported foot releases its previous bounded correction gradually toward the authored pose, while the supported foot keeps fitting its surface. Pelvis correction eases toward only reachable support; the 18 cm reach and 12 cm pelvis bounds remain. Airborne/seated/action poses still yield immediately to their animation, and invalid centre samples are ignored.

The existing gallery gains a footing view with the actual character straddling a slope and a deep drop. Existing flat, scaled, turned, stride-lift and cliff-safety cases remain, with regressions for independent support and release. This changes presentation only, not collision or jump height.
