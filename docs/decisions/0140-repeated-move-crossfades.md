# Consecutive moves retain independent animation clocks

## Context

The animator's two move slots were intended to blend one chop into the next. Their key only identified the move kind and clip, so consecutive uses of the same clip could reset its clock at full weight. Walking moves also shared one upper-body action between both slots, resetting both arms' poses together.

## Decision

Identify one-shot playback cycles by action kind, combo step and an age restart larger than one tick. Small clock corrections keep the existing cycle; looping rests keep their loop identity. Give each move slot its own upper-body clip clock, and clear its weight when the slot fades away or is reused.

## Consequences

Repeated chops and other consecutive one-shot moves fade between their old and new poses, both standing and walking. The animation still draws the same authoritative action and impact timing. Adds a bounded pair of split animation actions per applicable move, with no extra geometry or draw calls. Bone-position tests cover repeated chops, combo-step changes and sub-tick corrections; existing fishing and stance tests remain in place.
