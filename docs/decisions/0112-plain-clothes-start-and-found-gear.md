# 0112 · Everyone starts in plain clothes, and outfits become gear to find

**Status:** accepted · **Date:** 2026-10-07

## Context

Chris wants characters to start with minimal clothing and find gear as the journey goes on. Today each of the six characters is an outfit drawn on a body: the Knight in armour and a helmet, the Mage in a robe and a pointed hat, and so on. Choosing a character really means choosing an outfit.

## Decision

Settled with Chris:

- **Six bodies, in plain clothes.** The six stay as a choice, but each becomes a plain body wearing just a shirt and shorts, and nothing else. On the character screen they are called **Body 1 to Body 6**, in this order: Knight, Barbarian, Mage, Ranger, Rogue, Rogue Hooded. The ids behind the scenes (`knight`, `mage` and so on) do not change, because worlds and browsers have already saved them.
- **The current outfits become gear.** Each outfit's pieces (helmet, hat, cape, quiver, mask, armour or robe) are gear a character can find and wear.
- **Gear changes looks only.** No protection and no perks, in keeping with cozy-light survival.
- **Gear can be found four ways**, each its own change: rewards at discovery sites, hidden caches, creature drops, and crafting at home.
- **The dwarves are not used.** Their models, scripts and gallery entries are deleted (see the update at the end of decision 0107).

## What is done, and what is next

1. **Done here:** the Body 1 to Body 6 names, with a test that keeps them in order.
2. **Done in the art session** (2026-10-08): the plain bodies and the gear files. See the update at the end.
3. **Wearing gear in the game:** worn gear is chosen and saved by the server, sent to everyone nearby, and drawn on the character, the same way a held item is (decision 0041). New characters start plain.
4. **Finding gear**, one way per pull request.

## Brief for the art session

- For each of the six, make a plain body wearing **just a shirt and shorts** (Chris's words), on the **same skeleton** (`Rig_Medium`), with the **same part names** (`Body`, `ArmLeft`, `ArmRight`, `LegLeft`, `LegRight`, `Head`), the same size and the same pose, so every move the game plays still works. The shirt and shorts are drawn into those same parts, so none of the armour, robe, tunic, belts, straps, pauldrons or gloves from today's outfits is left on them. Keep each one's own head and hair. Nothing on the head, back or face: no helmet, hat, hood, mask, cape or quiver.
- Feet: "just a shirt and shorts" is read literally, so **bare feet**, with no boots. This is a default for Chris to correct, not a settled choice.
- Soft, plain colours that sit with the Quaternius forest. Keep each body under 10k triangles (the player budget).
- Save today's outfits as separate gear files: one per head piece (helmet and visor, bear hat, mage hat, mask), one per back piece (cape, quiver), and one per body outfit (chest, arms, legs).
- Try every gear piece on every body. The Barbarian is the stockiest, so note any piece that clips.
- Add `assets/LICENSES.csv` rows for every file (the Adventurers pack is CC0, Kay Lousberg) and show before and after in the gallery.

## Consequences

- Until the art session is done, characters look exactly as before; only the names changed.
- A character already made keeps its body, so it becomes that body in a shirt and shorts when the new art lands. **Not yet decided:** whether such a character gets their old outfit back as gear to find.
- Whether a piece drawn for one body fits another is unknown until it is tried. If it clips, pieces may be limited to the bodies they fit, or scaled.

## Update · 2026-10-08: the art session

- **The six bodies** now wear a short-sleeved shirt and shorts, with bare arms, legs and feet, on the same skeleton, part names, size and moves. Each has its own soft colours that nod to its old outfit, and the Barbarian is a little broader. They are 3,800 to 5,400 triangles each. `tools/art/plain_bodies.py` builds them in Blender from the pack's characters, so any change is made there and the models rebuilt; it is the same method as decision 0107 (vertex colours, no texture), with joint weights copied from the Rogue's own parts and the Mage's bare hands.
- **Body 6's hood was part of its head**, so it is cut off into gear. Underneath were only a fringe and no ears, so Body 6 has a chin-length bob in its own hair colour, as a separate `Hair` part.
- **17 gear files** in `assets/gear/`, each still skinned to `Rig_Medium`: head pieces `knight-helmet` (helmet and visor), `barbarian-bear-hat`, `mage-hat`, `rogue-hood`; the face piece `rogue-mask`; back pieces `ranger-quiver` and five capes (`knight-`, `mage-`, `ranger-`, `rogue-`, `rogue-hooded-cape`, which differ in shape as well as colour); and six whole outfits (`knight-armour`, `barbarian-outfit`, `mage-robe`, `ranger-outfit`, `rogue-outfit`, `rogue-hooded-outfit`).
- **Every piece was tried on every body** (`?gallery=bodies&gear=<name>`):
  - Outfits fit every body, Barbarian included, **as long as an outfit replaces the shirt, shorts, arms and legs** rather than going over them; worn over them, the shirt shows through at the shoulders and chest. The Ranger's scarf sits under the Barbarian's beard, which looks natural.
  - Capes and the quiver fit every body.
  - The helmet fits everyone; long hair shows below it at the sides, which reads fine.
  - The bear hat: Body 1's hair pokes through the top, and Body 4's and Body 5's through the front.
  - The mage hat: Body 1's hair pokes through the band.
  - The hood fits only Body 6, whose head it was drawn round; every other head pokes through it.
  - Hair is part of each head (except Body 6's bob, which a head piece hides), so fixing these means reshaping the piece or giving the hair a hat-shaped version. That is for when wearing gear is built.
