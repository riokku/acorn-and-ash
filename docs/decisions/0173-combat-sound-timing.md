# Combat sound timing

A partly observed skeleton swing supplied its remaining time to impact, but the audio envelope always kept its full 130 ms rise. With less time left, the sound peaked after contact. Scheduled swishes also survived flinches, removal and hidden-world pauses.

Swishes now peak exactly at the requested impact time by shortening only the rise when necessary. A small per-actor driver observes the rendered action, schedules once per move/step/restart, and cancels on interruption or disposal. The local player and skeletons use this driver; shovel and airborne follow-up timings remain tied to their shared rules. Completed/late-observed impacts are never replayed. Pausing or muting cancels active voices, and ended voices disconnect their nodes.

Damage, hit reactions, authored clips and attack rules are unchanged. Tests inspect scheduled WebAudio times for 30/100/400 ms remaining, interruption/restart/late observation, dodge follow-ups, pause/mute and cleanup.
