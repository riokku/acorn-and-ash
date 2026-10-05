# 0102 · Sit on the ground anywhere, with X

## Context

Sitting was only possible beside a home's chair (and lying down beside its bed), always with `E`. Chris asked for `X` to be the sit button, working anywhere on the ground, outdoors or in. At the same time `E` is the one "interact" key, so `X` is only for sitting.

Two things made this more than a key binding:

- **The player's action is decided by shared rules** (`advanceAction`), which the server and the player's own browser run identically. A sit that only the browser knew about would be undone by the next server answer, and a sit that only the server knew about would arrive a round trip late.
- **The input message had no room for another button.** All eight buttons filled its one button byte.

## Decision

- **A new action, `SitGround`, in the shared rules.** A fresh press of `Sit` from standing still starts it, on the same footing as the other starts: dodge wins, and it needs the ground underfoot and no fishing line out. The server and the player's browser both ask the same question (`canSit`), so they agree and nothing needs correcting.
- **Getting up** happens on walking off, `E`, `Space` or `X` again. It has a short minimum settle (four ticks), so a held key does not bounce the player straight back up. Getting up takes its own step (`RiseFrom.Sat`) and its own clip.
- **The button field is now two bytes** on the wire (`BYTES_PER_INPUT` goes from 7 to 8, little-endian). The new `Sit` button is bit 8. This is the only protocol change; a bundle of inputs grows by one byte per input, about 10–15 bytes a second per player.
- **"Is the player down?" has one answer.** The old checks looked at whether a rise began from a chair. A new `isDown(state)` (knocked out, or rising from the ground or the bed) is used instead, so sitting up from the ground or the chair is never mistaken for being flattened. Being down is what makes a player untouchable and ignored by creatures.
- **Three more clips** (`sitFloorDown`, `sitFloorIdle`, `sitFloorUp`) from the same CC0 KayKit pack, taking the shared library from 34 to 37 clips (+32 KB).

## Consequences

- Sitting on the ground is purely a rest for the eyes. It restores nothing, shelters nothing, and the player can still be hit, so a creature that arrives while they sit is a surprise, not a protection.
- Deploys that change the wire format must go out together. Previews are safe: each one has its own game server (decision 0011). Staging and production are deployed from the same commit.
- Any later action that needs a "the player is lying flat" check should use `isDown`, not look at `RiseFrom` directly.
- A future phase that adds real rest benefits (energy) can build on `SitGround` without touching the key or the wire again.
