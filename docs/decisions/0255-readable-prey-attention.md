# Readable prey attention and recovery

Prey already had movement-based notice distances, suspicion buildup, grazing and escape behavior. Its attentive flag also stayed active indefinitely around a quiet observer, and it kept turning toward the observer's current position even after the disturbance stopped.

Keep a transient last-disturbance point and 2.5 seconds of listening memory. First noticing a nearby presence, actual movement within hearing range, close visual presence or fleeing refreshes that point. Otherwise prey watches the remembered location briefly, then resumes its normal routine. Continued approach still builds the original awareness; close surprises and predators still cause immediate flight. Equipment notice modifiers, flee speeds, catch rules, rewards and hostile combat behavior stay unchanged. This uses the existing distance/speed senses; it does not introduce occlusion or directional hearing.

Add tense (16) and fleeing (32) prey flags to the existing animal action byte, preserving attack bits 1/2, alert bit 4 and defeated bit 8. Existing snapshot encoding carries them unchanged, and older clients still see the original alert/movement. Clients blend existing neck, ears, legs and body transforms for the warning pose and escape, and stagger calm animation phases by animal identity. No new models, textures, messages, timers or saved state.
