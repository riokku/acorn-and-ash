# Contact-aligned gait phases

Walk and run clips advanced independently, so their feet could be at unrelated
points in a step when acceleration blended the poses. The authored run's front
left-foot contact is at phase 0.125, matching the walk's phase-zero contact.

Advance one stride phase using the existing speed/cadence tuning and sample both
clips at their aligned phases. Upper and lower halves use that same phase. Slow
walking follows actual speed instead of enforcing a minimum pace. Blocking,
airborne poses and strong whole-body actions stop advancing the hidden stride;
resuming movement retains phase. Existing hit pauses consume only unpaused time.

This changes presentation only. Ground fitting retains the authored foot lift;
movement speed, collisions and shared action timing are unchanged. The phase is
available for cosmetic foot-contact feedback. Tests exercise blended clips,
frame-rate consistency and interruption; all six rigs were rendered at three
blend phases. Controlled before/after views use the existing models and clips.
