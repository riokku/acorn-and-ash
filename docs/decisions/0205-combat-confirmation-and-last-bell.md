# 0205 — Confirmed combat feedback and the Last Bell payoff

Existing combat already predicts sparks, flinches, hit-stop and camera impulses.
Adding more camera motion would obscure tells and amplify whirlwind impacts.

Add a short stationary ivory hit mark and a quiet low impact layer only when the
server confirms the local player's blow. Defeats use gold. Coalesce simultaneous
whirlwind confirmations into at most one cue per 70 ms. No new camera movement,
combat timing or damage changes are introduced.

Live Bonehollow expedition progress triggers a bronze bell and an existing
victory banner: captain defeat when watch objectives remain, or expedition
completion with an explicit return-home reward reminder. Initial state, duplicate
updates, claim replies and new cycles do not replay it. A generic encounter-clear
banner cannot immediately replace this payoff. Existing SFX volume applies and
audio nodes disconnect at completion.

The admin preview needs gear tags on descendant meshes as well as their group;
this supports the rigid Last Watch helm without duplicating its art. Backdrop
expectations follow the deliberate removal of spring/autumn falling squares.
