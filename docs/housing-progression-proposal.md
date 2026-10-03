# Housing progression proposal

Accepted direction from Chris, October 3, 2026. The implementation follows
decision 0073, including skeleton-dropped blueprints and permanent learning. Tent → teepee → small cabin → larger cabin is the
requested order.

| Tier         | Look and feel                                                          | Useful change                                                          |
| ------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Tent         | A low canvas shelter, warm lantern, bedroll and wooden storage chest   | An inexpensive first home, a place to rest and a reliable return point |
| Teepee       | A taller conical canvas shelter with exposed poles and a flap entrance | More standing room and space for a small table and stool               |
| Small cabin  | The existing honey-colored log cabin and furnished room                | A proper bed, hearth, windows and shelves                              |
| Larger cabin | A modest extension with a broader roof and porch                       | More floor space for decorating and a clearer living/sleeping area     |

## Recommended progression

Place a tent through the existing Build menu. Once a home stands, its menu entry
shows the next upgrade and the required materials. Upgrade the same home in
place, keeping its identity, owner, door lock, return point and stored contents.
Never allow a second home to bypass the progression. Existing cabins become the
small-cabin tier without any conversion cost or loss of contents.

Keep the recently agreed private chest at ten slots in all four tiers initially.
Make the homes differ through their appearance, room and furniture; a storage
capacity expansion can be designed separately later.

Upgrading a home needs more than replacing its model. The server must check
ownership, available materials and the enlarged footprint before spending
anything. Refuse an upgrade if it would swallow a tree, neighboring building,
water or a player. An occupied home should wait until everyone leaves before
its layout changes. Keep the entrance facing the same direction.

## Materials and presentation

Use gatherable materials already present for the first playable version: sticks
and logs. Canvas can be part of the shelter's appearance without adding a new
gathering dependency yet. Initial prices are six sticks for a tent; eight sticks and four logs for the
teepee upgrade; ten logs for the small cabin; twenty logs and eight sticks for
the larger cabin. Prices can be balanced after playtesting; the tent should
be attainable without crafting an axe, and later upgrades should fit a practical
number of gathering trips. Show ingredients and a reason when an upgrade cannot
proceed, rather than silently ignoring the click.

Each exterior needs a matching doorway and collision shape. Each interior needs
matching walls, furniture, resting poses, chest interaction and exit collision.
Use the existing painted, stylized art palette and original procedural models.
Avoid attaching invented tribal markings or cultural claims to the teepee.

## Validation before shipping

- Build the first tent and upgrade sequentially through all four tiers.
- Reject skipped tiers, a second home, visitor upgrades and insufficient payment.
- Preserve the same chest contents, slot order, ownership and lock after every
  upgrade, reconnect and world sleep/wake.
- Preserve already-built cabins and the numeric IDs of existing buildable kinds.
- Check door entry/exit, rest/wake positions, hover feedback and collision at each
  tier, including rotated homes.
- Refuse blocked enlargement without spending materials or replacing the home.
- Play the progression in the browser and inspect all four models/interiors.

## Settled choices

1. Upgrade the same home in place and retain storage.
2. Focus on housing before discoveries and rain.
3. Skeletons occasionally drop the next unlearned blueprint (initial chance: 30%).
4. Learning consumes one blueprint and belongs to the character in its current
   world. No XP system is introduced. Existing cabins imply earlier-tier knowledge.

The discovery journal and gentle rain remain follow-up recommendations. Housing
creates a useful destination for gathered materials and a natural shelter for
future rain ambience.
