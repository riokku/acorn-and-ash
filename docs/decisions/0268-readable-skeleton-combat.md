# Readable skeleton combat

Skeletons already share the player's animation library and buffered network
playback. Their figure-level wind-up detector, however, treated any backward age
correction as a new attack, unlike the animator and swing audio. Armored contacts
also applied hit-stop even when the server said the skeleton shrugged off the
blow. The king's ground warning remained visible throughout a light swing's
recovery and was flat on hills; ordinary skeletons had no ground warning.

Keep combat rules, difficulty, snapshots and animation clips unchanged. Match the
figure's new-move detection to the animator's one-tick reconciliation tolerance.
Reserve defender hit-stop and recoil for unshrugged contacts; armored contacts
retain their sparks, warm flash and clang.

Replace the king-only footprint with reusable skeleton attack warnings: a subtle
forward sector for light attacks and a violet perimeter for the charged
whirlwind. Derive radius, facing angle and timing from the existing combat
constants, including the king's longer charge and reach. Warnings follow the
buffered body and fit their vertices to the existing ground-height callback;
stationary fits are cached and invalidated between attacks. The footprint is a
readability aid, not a guarantee of damage: the server still selects targets,
checks dodges and settles blows. Cancel it on interruptions, departures, removal
and during the king's separately warned Soul Storm. Fade a light warning over
the two ticks after contact; clear a whirlwind warning at the end of its active
spin, leaving recovery visually quiet. Rehearse the new meshes behind loading.

The existing raider gallery now demonstrates the king's actual charge/recovery
timing and offers bounded, gallery-only inspection of the loaded rig and warning
geometry. Tests cover fractional corrections, armored versus real contacts,
every skeleton's reach/sector, combo contact/recovery, interruption, rotated
terrain fitting, caching and disposal. Chrome checks advance the actual warrior
and king rigs at controlled frame intervals independently of software-GPU speed.
