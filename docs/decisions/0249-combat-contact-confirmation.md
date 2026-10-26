# Combat contact confirmation

Confirmed own hits previously always skipped the enemy impact effect, assuming prediction had shown it. A corrected position or a figure that had not loaded yet could therefore leave a real hit without a visible reaction.

Keep a short per-enemy queue only for contacts actually shown. Consume a matching light/heavy prediction once when the server confirms it; otherwise show the confirmed impact from the local player's location. Another player's hits cannot consume our predictions. Queues expire after 1.5 seconds and clear with the enemy/world. Health and hit decisions remain entirely authoritative.

A successful server-reported dodge also shows a short, stationary “Evaded” cue near the action. Merely rolling does not trigger it. There is no added camera motion or simulation pause. Existing attack timing, damage, reach, warning animations and controls stay as they are.
