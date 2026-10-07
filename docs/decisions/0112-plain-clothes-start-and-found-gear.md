# 0112 · Everyone starts in plain clothes, and outfits become gear to find

**Status:** accepted · **Date:** 2026-10-07

## Context

Chris wants characters to start with minimal clothing and find gear as the journey goes on. Today each of the six characters is an outfit drawn on a body: the Knight in armour and a helmet, the Mage in a robe and a pointed hat, and so on. Choosing a character really means choosing an outfit.

## Decision

Settled with Chris:

- **Six bodies, in plain clothes.** The six stay as a choice, but each becomes a plain-clothes version of itself (simple tunic, trousers and boots). On the character screen they are called **Body 1 to Body 6**, in this order: Knight, Barbarian, Mage, Ranger, Rogue, Rogue Hooded. The ids behind the scenes (`knight`, `mage` and so on) do not change, because worlds and browsers have already saved them.
- **The current outfits become gear.** Each outfit's pieces (helmet, hat, cape, quiver, mask, armour or robe) are gear a character can find and wear.
- **Gear changes looks only.** No protection and no perks, in keeping with cozy-light survival.
- **Gear can be found four ways**, each its own change: rewards at discovery sites, hidden caches, creature drops, and crafting at home.
- **The dwarves are not used.** Their models, scripts and gallery entries are deleted (see the update at the end of decision 0107).

## What is done, and what is next

1. **Done here:** the Body 1 to Body 6 names, with a test that keeps them in order.
2. **Art session, on Chris's computer** (Blender is not reachable from cloud sessions; see decision 0105). The brief is below.
3. **Wearing gear in the game:** worn gear is chosen and saved by the server, sent to everyone nearby, and drawn on the character, the same way a held item is (decision 0041). New characters start plain.
4. **Finding gear**, one way per pull request.

## Brief for the art session

- For each of the six, make a plain-clothes body on the **same skeleton** (`Rig_Medium`), with the **same part names** (`Body`, `ArmLeft`, `ArmRight`, `LegLeft`, `LegRight`, `Head`), the same size and the same pose, so every move the game plays still works. Keep each one's own head and hair. Nothing on the head, back or face: no helmet, hat, hood, mask, cape or quiver.
- Soft, plain colours that sit with the Quaternius forest. Keep each body under 10k triangles (the player budget).
- Save today's outfits as separate gear files: one per head piece (helmet and visor, bear hat, mage hat, mask), one per back piece (cape, quiver), and one per body outfit (chest, arms, legs).
- Try every gear piece on every body. The Barbarian is the stockiest, so note any piece that clips.
- Add `assets/LICENSES.csv` rows for every file (the Adventurers pack is CC0, Kay Lousberg) and show before and after in the gallery.

## Consequences

- Until the art session is done, characters look exactly as before; only the names changed.
- A character already made keeps its body, so it becomes that body in plain clothes when the new art lands. **Not yet decided:** whether such a character gets their old outfit back as gear to find.
- Whether a piece drawn for one body fits another is unknown until it is tried. If it clips, pieces may be limited to the bodies they fit, or scaled.
