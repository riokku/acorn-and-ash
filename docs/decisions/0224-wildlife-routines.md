# Wildlife routines and physical surroundings

Calm wildlife now pauses between wander destinations: rabbits forage, foxes sniff,
and elk have time to perform their existing grazing animation. Durations are
seeded by animal identity and decision count. Players and predators interrupt
pauses immediately; hunting and hostile combat retain priority.

Small prey chooses a reachable dry point beside an existing nearby boulder as
shelter. Rain, storms and blizzards send it there at walking speed. When fleeing,
cover only influences direction if it is away from danger; no animal turns back
into an attacker to reach shelter. No suitable cover means ordinary behavior.

Wander targets reject deep water, steep ground and solid obstacles using existing
collision broadphase. Small wildlife now has explicit collision bodies, so the
same solver prevents walking through rocks and trees. Existing entity IDs,
scenery, models and snapshot fields stay unchanged. Stopped velocity lets existing
idle/grazing animation settle naturally. No additional timers or saved state are
needed; disconnected worlds continue to hibernate normally.

Night patrols retain their established circuits and now scan outward while
pausing at corners, rather than staring along their last walking direction.
