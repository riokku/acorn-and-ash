# A soundscape that leaves room for action

Extend the existing two-voice water/wind ambience rather than spawning new loops. Lake, pond, spring and slough shores now contribute a quieter, softer water texture. Shore samples are computed once from the actual basin/island boundaries; overlapping circles do not create imaginary shores. Nearby sources blend their stereo direction and tone by energy instead of switching abruptly to the loudest source. Narrow/fast stream reaches use the existing flow-pace data for a brighter texture. Frozen water stays silent.

A nearby skeleton attack, confirmed own hit or non-cold damage briefly lowers wind/water ambience and suppresses new bird calls. Rustles become quieter; footsteps and combat cues retain their normal level. The mix eases down quickly and recovers gradually, with no queued chorus afterward.

Sampling remains four times per second, with exactly two sustained voices and the existing mute, pause and disposal lifecycle. No network changes, extra timers, downloaded sounds or new assets. This affects presentation only, not enemy awareness, combat balance or water physics.
