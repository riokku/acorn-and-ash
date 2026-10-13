# Move context through clock corrections

The animator tolerates a small backward action-clock correction, but MoveMemory
previously treated every backward change as a new action. A removed tree or a
cursor moving away from a cache could switch chopping/digging to a combat swing;
a charged wind-up could lose its follow-through and a flinch could change sides.

Match the animator's one-tick tolerance when deciding whether to remember fresh
context. Kind changes, combo steps and substantial clock restarts still start a
new move. The corrected clock itself remains available to the animator. This
changes only presentation, without changing hit timing or authoritative actions.

Validation covers disappearing trees, changing digging context, charged swings
and flinch variation through corrections and subsequent genuine restarts.
