# Committed attacks and readable openings

Creature combat should reward observing and evading an attack. Coyotes now stalk
in a short lateral arc before approaching from mid-range, alternating sides by
stable entity ID. A point-blank coyote still begins its existing 0.8-second
wind-up immediately. Each bite locks its original victim and direction; moving
behind it, leaving reach or gaining sufficient elevation avoids the hit. A miss
still incurs the full existing recovery. Pursuit limits and ordinary damage stay
unchanged. Other wildlife keeps its existing radial attacks.

Skeletons stop tracking during the final 150 ms of a wind-up (250 ms for a charge)
and commit once swinging, with a small correction at the beginning of subsequent
combo cuts. Completed attacks open a guaranteed recovery of 0.55–1.2 seconds
according to kind; the captain's whirlwind keeps its longer 1.4-second opening.
They cannot instantly dodge a counter during that opening. A player-created
flinch still uses the existing escape/poise rules, avoiding endless stun locks.

All decisions and hit checks remain on the server. Creature data specifies stalk
and recovery timing. Existing snapshot fields carry the wind-up/bite/recovery
poses: a stronger blended crouch, bite and settling pose uses the existing fox
figure for coyotes without moving its authoritative root. No new protocol IDs,
models or textures are introduced. Small creatures also follow the local ground
plane with a damped pitch/roll, sampled at 10 Hz; their network roots stay fixed. Lean is limited to a natural 20 degrees; the
mesa-side den moves eight metres onto gentler ground while retaining its ID. The plains gallery can hold coyote poses with
`view=tactics&pose=windup`, `pose=bite` or `pose=recovery`.
