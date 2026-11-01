# Acorn & Ash

A cozy, third-person survival game that runs in the browser. You live in a
stylized low-poly forest: gather, hunt, fish, fend off creatures, and build a
cabin you can upgrade and decorate.

The game is online-only. Every world runs on the server.

The **C journal** now includes Discoveries: clues and sketches lead to a forgotten
camp, an old logging site, a mushroom grove and a mossy shrine. Locations appear
on your map once found. Clear nearby guards and press **E** to inspect for your
own once-per-character supplies and recipe; a full pack keeps the reward waiting.
Berries and mushrooms are shared forage. Learned recipes make trail rations,
forest stew and berry tea; stew and tea need a lit campfire. Your discoveries and
recipes survive reconnecting and the world sleeping. See
[decision 0075](docs/decisions/0075-discoveries-and-forest-food.md).

> **Phase 4 — Danger.** Right now there is a hand-built home clearing with
> Douglas-fir, western redcedar and Sitka spruce trees, real rocks and a pond,
> surrounded by generated wilderness you can walk out into, a real animated
> character you walk, sprint and jump around, a
> third-person camera, and a server that decides where everybody is. Your
> pack starts with six slots, and the bag near where you start adds four
> more. Find the axe standing in a stump and chop trees down;
> they grow back while you are away. Find the rod on the bank of the pond
> and catch fish. Gather sticks by hand and craft your own axe or rod
> instead. A hotbar along the bottom shows what you're carrying, six slots
> at a time - a small icon apiece now, rather than a plain colour swatch -
> press a number to equip whatever is in that slot, eating it too
> if it's food. Whatever you have equipped shows in your character's hand,
> for everyone nearby to see, not just you - and nothing else works: you
> cannot chop, fish or eat a fish unless it's the one currently equipped.
> You get hungry the longer you
> play, and eating a fish tops you back up. Rabbits live out in the
> wilderness - walk up on one and it bolts, but catch it with the same axe
> that fells a tree and it pays out meat, worth even more than a fish. Chop
> enough logs and you can build a campfire. Gather sticks for a tent, then
> learn skeleton-dropped blueprints to upgrade through a teepee and two cabin
> sizes. Your home is where you start next time, instead of the open clearing.
> Gather flowers the same way as sticks and plant a flower bed or a lantern
> to decorate the place. A masked raccoon lives out there too, and it is not
> shy - it comes after you, and enough hits knock you out. You wake up safe
> at home, or the clearing, having buried half of what you were carrying
> right where you went down - your axe and rod always stay with you - so
> it's worth walking back for. Or fight it off first, with the same axe, and
> it runs off empty-handed. A quick dodge can get you through its swing
> untouched, timed right, and holding left click winds up a heavy swing of
> your own that finishes a tree or a fight outright - if you can afford to
> stand still long enough for it. A day passes every twenty minutes, the sky
> brightening and dimming the same way for everyone in the world at once -
> nothing plays differently by night yet, but it's there to watch. Chopping,
> landing a hit and taking one all have a bit of weight to them now - a small
> camera kick and a sound - and a calm tune plays once you're in. The
> campfire has real art now, and you can light it - press `E` next to one -
> for a genuinely animated fire that flickers for a while and either burns
> down on its own or goes out early if you put it out by hand. The axe and
> fishing rod are real modeled art now too. Everything that used to be a
> flat colour is painted now: lawn grass and leaf-strewn forest floor, a
> rippling pond with lily pads and cattails, mossy rocks, and a log cabin,
> split-rail fence, garden lantern, planter, path stones, rabbit and masked
> raccoon all rebuilt as real little models. A fox roams the wilderness
> alongside the rabbits and the raccoon - it flees you exactly like a
> rabbit, but sometimes hunts one down itself, and you can catch it the
> same way you catch any other prey. Every player now walks, runs and jumps
> as a real animated character, and a Home screen now asks who you are
> before you step into the clearing - a name, a tint, and a character, all
> six of the pack's now real and pickable. Everybody else sees your name,
> colour and character too. A lit campfire, a built lantern and a torch you
> can now craft from a couple of sticks all cast real firelight of their
> own now, flickering the way fire actually does rather than just glowing
> in place - the first real reason to have one of the three going before
> night falls. The build menu now offers a fence and a garden path stone
> too, both cheap and uncapped so a whole line of either is one trip's
> worth of gathering, not a single decoration like the flower bed or the
> lantern. The masked raccoon now notices you from much farther away once
> night falls, unless you are carrying a lit torch or standing near a lit
> campfire or a built lantern - the first real reason night itself is
> something to plan around, not just something to watch. A small compass
> also now appears on screen whenever you have something buried and not yet
> dug up, pointing the way back to it, so finding your way there again is
> never just luck. The mouse is free now, the way it is in World of
> Warcraft - click on a tree, an animal, the water, the hotbar or your pack
> instead of it being captured for your whole time in the world, with the
> right button turning the camera on its own and a tooltip on every hotbar
> slot. Press `B`, or click the new bag button, to see everything you're
> carrying and drag any of it onto the bar. Only a right-button drag turns
> the camera now: a left click on a tree, an animal or the water turns your
> character to face it instead, leaving the view exactly where you put it.
> Building shows a see-through preview first now, following your mouse,
> green where it fits and red where it doesn't - turn it with the wheel,
> click to place it, and fence pieces snap together end to end.
> See [the roadmap](#roadmap).

### Your homestead

Your first tent establishes a private building area. Its radius grows with your
home: **12 m** for a tent, **18 m** for a teepee, **26 m** for a small cabin and
**36 m** for a larger cabin. Open C or select a building piece to see a ground
boundary, minimap outline and radius label. Upgrades preview the larger area.
The whole object must fit inside your plot; visitors cannot build there.

Homes can be established in suitable wilderness clearings. New plots and upgrades
keep clear of other homes, discoveries and encounter sites. Water, trees, rocks,
uneven foundations and the world edge also prevent placement. Existing homes and
placed objects remain intact. See [decision 0077](docs/decisions/0077-private-wilderness-homesteads.md).

## Controls

The in-game guide lives in **Settings → Keybindings**, on the Home screen or
during normal play or while paused. The gear beside the minimap opens Settings
without leaving the game; movement and action inputs stop while the panel is open.
Keybindings uses two columns on wider screens and one on smaller screens.
Exploration keeps contextual action and danger prompts, with no persistent
movement or building tutorial. These are the current fixed bindings.

Starting play shows a Pacific Northwest dawn landscape and “Entering the woods…”
while a progress bar follows completed loading stages, including the first drawn
world frame. A stalled stage keeps its percentage until it finishes. Loading
errors offer a retry button.
Signing in indoors also prepares an outdoor frame before showing the room. The
forest remains loaded around the home while you are inside; door fades wait for
the destination's first frames to settle, with a quiet loading indicator on slower
transitions. See [decision 0192](docs/decisions/0192-preparing-home-transitions.md).

Hover world loot to see its name, quantity, and whether you can reach or carry it.
A short right-click picks that specific item up; a drag still turns the camera.
Thin or bobbing loot has a three-pixel cursor tolerance for both hover and clicks.
The painted pointer turns into a loot bag over loot and chests; review both
cursor images at `/?gallery=cursors`. See [painted cursors](docs/design/painted-cursors.md).
Direct hits win, and nearby samples still respect scenery occlusion. See
[cursor loot targeting](docs/decisions/0152-thin-loot-cursor-tolerance.md).
Patches give one item per click, and piles give as much as fits. E remains the
nearby interaction shortcut. Inventory and hotbar tooltips explain what items do.

| Key                                  | Does                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------ |
| `W` `A` `S` `D` or the arrow keys    | Walk                                                                     |
| `Shift` (held)                       | Sprint                                                                   |
| `Space`                              | Jump                                                                     |
| `X`                                  | Sit down on the ground, anywhere (move, or `X` or `E` again, to get up)  |
| Right mouse on world loot (tap)      | Pick up the clicked item or gather one from a patch                      |
| `E`                                  | Pick up nearby loot, gather, dig up a cache, use/cook at a campfire, eat |
| `E` beside your chair or bed         | Sit down or lie down (move, or `E` again, to get up)                     |
| `E` beside a canoe                   | Climb in (one rider to a boat); in a boat at a shore, climb out          |
| `E` at your expedition board         | Read the board on your doorstep; `E` again to put it away                |
| `W` `A` `S` `D`, `Shift` (in a boat) | Row (steer toward where you point), pull harder                          |
| `1`–`6`                              | Equip the hotbar slot - eats it too if it's food                         |
| `C`                                  | Open the Craft menu: everything you can make or place, on one list       |
| `1`–`9` (Craft menu open)            | Pick the entry with that number on the page showing (axe, rod, torch...) |
| Decorate button indoors              | Decorate the room                                                        |
| Left mouse (piece picked)            | Place it where its preview stands                                        |
| Mouse wheel (piece picked)           | Turn it                                                                  |
| `Shift` (held, fence picked)         | Place it freely instead of joining it onto another fence                 |
| `Esc` or right mouse tap             | Put the piece away                                                       |
| `B` (or `I`), or the bag button      | Open or close your pack                                                  |
| `Z`                                  | Open or close your character screen and put gear on (see below)          |
| Right mouse on a pack or hotbar slot | Drop one, drop all, or destroy what's in it                              |
| `M`, or click the minimap            | Open or close the map                                                    |
| Walk into your door, or `E` there    | Go inside your home, or back out                                         |
| `Tab` / `Shift+Tab`                  | Select the next / previous nearby hostile target (30 m; favors in front) |
| Left mouse (quick click)             | Aim on press; release to chop/fight; cast or hook on press               |
| Left mouse (click as a swing lands)  | Carry on into the next swing, up to three in a row                       |
| Left mouse (held, then released)     | Charge without a light swing; release to strike                          |
| Right mouse (held), then drag        | Turn the camera                                                          |
| Left `Ctrl`                          | Dodge roll                                                               |
| `Esc`                                | Close a panel, clear your target, or pause                               |

Tab targeting marks the selected enemy with a gold diamond and name, including a directional marker when off screen. Escape clears selection after closing any open panel. Targets clear on death, despawn, or leaving the 30 m range. In melee range, attack aim assistance favors the selected enemy; hits still use normal weapon reach. See [tab targeting](docs/decisions/0111-tab-targeting.md).

There is nothing to land on yet, so a jump is a hop in place.

The mouse is free the rest of the time, the way it is in World of Warcraft:
click on a tree, an animal or the water and your character turns to face it,
and the same click chops, catches or casts. A fishing click never also swings
a weapon. Casting carries into waiting within the same animation frame, including
on a slow frame; see [overlay transitions](docs/decisions/0151-timed-overlay-overlap.md).
Click the hotbar or your pack instead of only pressing a number. Only holding the right button and
dragging turns the camera - a left click never moves it. Your character
swings or casts whichever way it faces: the way you last clicked, or the way
you are walking. See
[decision 0050](docs/decisions/0050-wow-style-mouse-and-inventory.md) and
[decision 0051](docs/decisions/0051-a-click-turns-the-character-not-the-camera.md).

The outdoor camera checks the center and corners of its view against trunks,
rocks and terrain, including after impact shake. It pulls in immediately and
eases back out when the view clears. See
[camera scenery clearance](docs/decisions/0146-camera-view-edge-clearance.md).
Camera release and fishing tilt use elapsed-time easing, giving the same motion
at different frame rates while preserving immediate collision pull-in. See
[camera easing](docs/decisions/0149-camera-easing-by-elapsed-time.md).

If the connection drops, crafting, item use, gear changes and placement explain
that they need a connection. Unsent placements keep their preview. Reconnecting
never replays old clicks; click again deliberately once connected. Items and
buildings still change only when the server confirms them. See
[decision 0133](docs/decisions/0133-action-submission-feedback.md).
Crafting waits for one server result at a time, with visible confirmation or a
specific refusal. Rapid clicks and number keys cannot submit duplicate crafts
while a reply is pending. Slow replies stay marked as waiting; they never retry
automatically. See [decision 0134](docs/decisions/0134-crafting-confirmation-and-refusal.md).
Indoor decoration previews remain visible while waiting for confirmation. A
refused placement keeps its preview for retry, and moving or packing up furniture
waits for its own private reply. Escape hides a preview without cancelling a
request already sent. See [decision 0135](docs/decisions/0135-indoor-decoration-confirmation.md).
Outdoor placement follows the same confirmation/refusal pattern. Capped previews
close after confirmed placement; repeatable pieces stay available. See
[decision 0136](docs/decisions/0136-outdoor-placement-results.md).

Your pack has six slots to start with. The bag, a few steps from where you
start, adds four more, for ten. Each additional bag adds four slots up to a
maximum of 24 (the final upgrade adds two). Bags persist through knockout and
rejoining; extra bags stay on the ground at the cap. A slot holds up to ten of one thing - logs,
sticks, flowers, meat or one kind of fish - so fourteen logs take two slots.
A tool takes a whole slot, and you only ever carry one of each. The bag
itself never takes a slot. How much fits in a slot, what the bag adds, and
how much hunger eating something restores,
live in [`packages/shared/src/data/items.ts`](packages/shared/src/data/items.ts),
what each tree costs in swings and pays in logs lives in
[`packages/shared/src/data/props.ts`](packages/shared/src/data/props.ts), and
which fish bite and how often lives in
[`packages/shared/src/data/fish.ts`](packages/shared/src/data/fish.ts). See
[decision 0060](docs/decisions/0060-a-pack-of-slots.md).

A hotbar along the bottom of the screen shows what's in your pack, six slots
at a time - wire order unless you have dragged something onto a slot
yourself, in which case that slot keeps showing it from then on. Press its
number, or click it, to equip whatever is shown there - shown in your hand
from then on, for anyone nearby to see - eating it too, right away, if it's
food. Hover a slot for a tooltip saying what it is. Styled as a row of
wax-seal circles on a parchment strip, the same warm look the craft and
build menus and the Home screen all now share. See
[decision 0043](docs/decisions/0043-a-field-journal-for-crafting-and-carrying.md).

The bag button at the end of the hotbar shows how full your pack is: its
ring has one segment per slot, filled for each one in use, with "4/6"
underneath. It turns orange once every slot is taken. Press `B`, or click
it, to open your pack and see everything you're carrying, not just the six
there's room for on the bar - the same parchment look, with a meter of slots
used, one square per slot (empty ones dashed), and every stack's icon, name
and count. Drag one onto a
hotbar slot to pin it there, or drag a hotbar slot back onto the pack to
unpin it; clicking an item in either place equips it, the same as its
number key. See
[decision 0050](docs/decisions/0050-wow-style-mouse-and-inventory.md) and
[decision 0060](docs/decisions/0060-a-pack-of-slots.md).

Right-click any slot, in the pack or on the hotbar, to make room: **Drop
one**, **Drop all**, or **Destroy**, which asks "Are you sure?" first.
Dropped things land just in front of you in a pile that anybody can pick
up with `E`, and fade after ten minutes if nobody does. Destroyed things
are gone for good. Nothing can be dropped indoors, and the bag never
leaves you, since it holds your extra slots. Whenever something goes into
your pack - gathered, picked up, looted, caught or crafted - a small card
in the bottom right says so, such as "+3 Sticks", adding repeats together
rather than stacking them up. See
[decision 0061](docs/decisions/0061-patches-run-out-and-dropping.md).

### The front door

The first thing anyone sees is the painted forest valley with a **Play** button.
Play leads to **Create account** and **Log in** (both are Google and Discord
buttons, with their logos, worded to match), and a player who is already signed
in goes straight to their character. The same painting sits behind the
character screen and the loading screen. Your own machine and the browser tests
skip the front page; previews and the real game show it. See
[decision 0103](docs/decisions/0103-the-front-door.md).

The shared landscape uses the painted icons' warm storybook style. Inspect it
in the [backdrop gallery](docs/design/storybook-backdrop.md) at `/?gallery=backdrop`.

The painting is alive and follows the seasons. Mist drifts, the lake glints,
smoke rises from the chimney, the cabin window glows and the camera moves very
slowly. In autumn the leaves turn gold and red and fall, in winter the trees go
frosty, the lake freezes and light snow falls, and spring brings fresh green foliage.
It uses the same calendar as the game. To look at one season, add `?season=`
to the address, such as `?season=winter` (also `spring`, `summer`, `autumn`).
Someone who has asked their computer for less motion gets a still picture, and
a computer that cannot keep up gets fewer leaves and then stillness. See
[decision 0106](docs/decisions/0106-a-living-seasonal-backdrop.md).

### Signing out

**Settings** (the gear) has an **Account** section with **Sign out**. In the
game it takes ten seconds: a banner counts down with a **Cancel** button, and
moving, swinging or getting hit cancels it. On the character screen it signs
out at once. Either way you land back on the front page. See
[decision 0104](docs/decisions/0104-sign-out-from-the-game.md).

### Deleting your character

**Settings** (the gear) → **Account** has **Delete character…**, and the
character screen has a small **Delete this character** link. Both ask you to
type the character's name, then **Delete forever**. The character is gone at
once (pack, hunger, map, fish collection, home) and you land back on a fresh
character screen to pick a new name and look. Everything they built (the cabin,
campfires, fences, decorations) stays standing but **locked**, so nobody can
use or break it, and disappears all together after 30 minutes, counted in real
time even while the world is asleep. Previews and local runs use two minutes,
set by `WORLD_ABANDONED_SECONDS` in
[`apps/game-server/wrangler.jsonc`](apps/game-server/wrangler.jsonc). Caches
buried after a knockout go immediately. Each character finds their own axe, bag
and rod. See [decision 0108](docs/decisions/0108-deleting-a-character.md) and
[decision 0109](docs/decisions/0109-everyone-finds-their-own-tools.md).

### Your character

Before the clearing loads, a Home screen asks who you are: a name, a
character and a tint. All six characters from a free pack can be picked, each
walking, running and jumping for real rather than sliding around as a
placeholder capsule. They are called Body 1 to Body 6: a character is a body,
and the outfits the pack drew on them (the Knight's armour, the Mage's hat and
so on) are meant to become gear you find along the way, so everyone starts in
just a shirt and shorts. The bodies now wear just that, and the old outfits
are saved as separate gear in [`assets/gear/`](assets/gear/); wearing and
finding gear in the game are still to come (see
[decision 0112](docs/decisions/0112-plain-clothes-start-and-found-gear.md)).
All six bodies are now chubby, faceted dwarves of our own (three men, three
women), still called Body 1 to Body 6; an old character becomes the dwarf with
the same number, keeping its skin tone and progress. Gear still works on a
dwarf but is not drawn on one until each piece has been refitted, one family at
a time. Dwarves play their own copy of the moves, fitted to their shorter
limbs. See [decision 0270](docs/decisions/0270-dwarf-bodies.md).
You also pick a skin tone: the body's own skin, or a little lighter or darker,
from a row of five swatches; only the skin changes, never the hair or clothes
(see [decision 0113](docs/decisions/0113-skin-tones.md)).
Your name, tint, character and skin tone travel to
the server and out to everybody else in the clearing, with a small name tag
floating over your head the same way it does over anyone else's. Picked
once, remembered the next time you visit. See
[decision 0037](docs/decisions/0037-choosing-a-name-and-a-character.md),
[decision 0036](docs/decisions/0036-a-real-moving-character.md) and
[decision 0044](docs/decisions/0044-the-rest-of-the-adventurers.md).

The character screen shows your character off, in the style of a classic
online-game login. They stand in front of the painted valley in their real
idle stance (the same model and moves as in the game), tinted and named as you
choose. **Drag** to turn them, **click** for a little flourish (a hop, then a
reach, then a pick-up), or use the arrow keys and Space. A returning player
sees their own character in the middle of the painting, under the title and
above an **Enter World** card, all centred on the screen. Someone who asked for less motion gets them holding their
pose, and a computer that cannot draw the character still gets the whole
screen without it. See
[decision 0107](docs/decisions/0107-the-character-screen.md).

Whatever hotbar slot you last pressed shows in your hand - the axe, the rod,
or whatever fish or meat you picked - parented straight onto the character's
own hand, so it moves with the arm through every animation. Not automatic:
finding a tool or catching a fish does not equip it on its own, only
pressing its slot does - and nothing works with it until you have. A left
click only chops a tree once the axe is the one shown in your hand, and a
cast needs the rod shown the same way; anything in hand, though, even a
fish, takes a swing at an animal. Carrying a
tool you haven't equipped does nothing for you. Everyone nearby sees it too,
not just you - the server tells every connected player what everyone else
has equipped, the same way it already tells them each other's names. See
[decision 0036](docs/decisions/0036-a-real-moving-character.md) for the
held axe's own first appearance,
[decision 0041](docs/decisions/0041-showing-what-you-have-equipped.md) for
making it a real, shared choice covering every tool and food item, and
[decision 0045](docs/decisions/0045-an-item-has-to-be-active-to-use-it.md)
for making it something you need, not just something you can see.

The axe is carried blade first, leaning forward, and every blow lands edge
first - see [decision 0058](docs/decisions/0058-the-axe-blade-first.md).

### Moves

Consecutive uses of the same action animation crossfade instead of resetting
at full weight. Walking moves keep separate upper-body clocks for that blend,
while small network clock corrections retain the current swing. See
[repeated move crossfades](docs/decisions/0140-repeated-move-crossfades.md).
A small correction also retains chopping, digging and wind-up context, so a
move does not switch animation midway through. See
[stable move context](docs/decisions/0147-move-context-through-clock-corrections.md).

Every move your character makes is a real animation now, from KayKit's free
Character Animations pack: three different swings in a row if you keep
clicking as each one lands, a crouch and two whirlwind turns for a
charged strike, a tumble for a dodge, a stagger when something hits you,
falling down when you're knocked out and getting back up, chopping at a tree
like a woodcutter, casting, waiting and reeling at the pond, bending down to
pick things up, digging with a shovel, lifting food to your mouth a bite at
a time, and sitting and lying down at home. Swift attacks keep your feet free to walk or run through the whole swing.

Grounded walking and running retain restrained terrain fitting, including free
legs under a moving attack. The fit preserves each animated foot lift and fades
before the ankle reach limit; jumps, rolls and seated poses retain their usual
footing. See [grounded stride contact](docs/decisions/0144-grounded-strides-fit-terrain.md).
Walking and running share a contact-aligned stride phase, including during speed
changes. Blocked movement, full-body moves and airborne poses yield their footing.
See [aligned gait phases](docs/decisions/0150-contact-aligned-gait-phases.md).
Charged strikes let you move freely once released. Everybody else sees the same moves on you.

Chopping and combat impact pauses consume their exact duration, including when
a render frame runs slowly. Animation blends pause with the character and use
the remainder of a frame after a hit pause ends. See
[impact pause timing](docs/decisions/0139-impact-pauses-use-exact-frame-time.md).

Blows land on the very moment the animation does, and feel like it: a brief
pause on the hit, a little camera kick, chips of wood flying out of a tree
as it shivers, tufts of fur off an animal as it's knocked back, a pale streak
behind the swing, a whoosh through the air, and dust where an aerial slam
hits the ground. See
[decision 0056](docs/decisions/0056-moves-with-weight.md).

### The wilderness

Past the clearing's own ring of trees the ground rolls into hills, and the
forest thickens the further out you go, out to a wall 300 m from the centre.
In the far south-west a mountain range rises out of the hills (see
[decision 0114](docs/decisions/0114-mountain-stream-and-digging.md)): pine forest
thins to bare rock, snow caps the top, and cliffs block the way while gentle
slopes can be walked. A shallow stream with five small waterfalls runs down
from a spring on the mountain, winding west of the clearing, into the lake's west
shore; you can wade it (`packages/shared/src/world/stream.ts`). Stone and iron ore lie
in piles on the slopes (`packages/shared/src/world/mountain-rocks.ts`) and a shovel can be
crafted from sticks and stone. With it equipped, a click digs a tunnel and a held click digs down
(`packages/shared/src/world/digging.ts`); digs are saved, shared, and dark without a torch.
It's generated from the world's seed, so the server and every browser draw
the same hills and the same trees without anything about them going over the
wire - the same trick the clearing itself already uses. Every tree out there
can be chopped down with the axe, exactly like the clearing's: the same number
of swings, a stump, logs to gather, and the tree grows back (see "Trees growing back"
below). See [decision 0015](docs/decisions/0015-wilderness-beyond-the-clearing.md)
for the forest itself and
[decision 0098](docs/decisions/0098-every-tree-can-be-chopped.md) for chopping it.

The river begins in a rock-framed mountain spring and its banks vary independently
while sharing shoreline and depth rules with movement and boats. Inspect
`?gallery=mountain-spring` (add `&frozen` for ice) or `?gallery=river-banks&spin`.
See [decision 0157](docs/decisions/0157-mountain-spring-and-independent-river-banks.md).

### The lake

In the north-east corner of the world, a good walk from home, there is a big
lake: about a hundred metres across, with five islands in it. It's the same in
every world. The ground slopes down to a gentle beach, the water goes from clear
green in the shallows to deep blue, and there are reeds, lily pads and stones
along the shore. You can't wade in: the shore holds you back, and you slide
along it if you walk at it on a slant. The islands, with their own trees and
rocks, are out of reach on foot: you reach them by canoe. It shows on
the minimap and the big map. You can cast a rod onto the lake the same as onto
the pond (a cast never lands on an island). In winter the lake freezes over: see
[Canoe](#canoe) below. The code is in
`packages/shared/src/world/lake.ts` and `apps/client/src/scene/lake.ts`. See
[decision 0090](docs/decisions/0090-the-lake.md).

### Reeds and rope

Most of the reeds at the lake and the pond are just scenery. A few are **mature
reeds**: taller and golden, with fat brown cattails, so they stand out across
the water. Six of them start out along the lake's bank, a long walk apart, and
two more stand on the east bank of the pond in the home clearing. Stand at the
water's edge beside one and press E (or right-click) to cut a reed; a bed holds
two to six. Once it is cut bare it comes back after a random fifteen to
twenty-five minutes, at a different place round the shore of the same water: a
pond bed never turns up at the lake, nor the other way round, so both always
have some. Open the Craft menu (`C`), turn to its **Lake** page and twist three
reeds into a length of rope, by hand with no workbench. Rope is for the canoe,
below, which is for the lake only.

The places are worked out in `packages/shared/src/world/reeds.ts` and drawn in
`apps/client/src/scene/reed-models.ts`. `local` runs and preview links bring a
bed back in 45 to 75 seconds instead, set by `WORLD_REED_REGROW_SECONDS` in
[`apps/game-server/wrangler.jsonc`](apps/game-server/wrangler.jsonc). See
[decision 0091](docs/decisions/0091-reeds-and-rope.md),
[decision 0099](docs/decisions/0099-mature-reeds.md) and
[decision 0101](docs/decisions/0101-reeds-at-every-water.md).

### Canoe

With six logs and two rope, open the Craft menu (`C` or `B`) and pick **Canoe** on
the Lake page. Stand on the bank, point at the water a step or two out, and a see-through
boat floats there: green where it fits, red where it can't. Scroll to turn it
along the bank, then click to moor it. You can have one, and it stays where you
built it. A boat needs water under all of it (so not on the sand) and can't be
moored far out in the deep; unlike a cabin, it doesn't need a home or flat
ground. The mooring rule is in `packages/shared/src/world/boat.ts` and
`sim/building.ts`, and the model is `apps/client/src/scene/rowboat.ts`. See
[decision 0092](docs/decisions/0092-rowboat-mooring.md).

Stand within a few steps of a boat and press `E` to climb in. You sit in the
middle with the bow ahead of you. Move to row: the boat turns toward the way you
point (relative to the camera, like walking) and picks up speed as it comes
round, and `Shift` pulls harder. Let go and it glides; in the river the current
carries it downstream and gently turns its bow with the channel. The narrow canoe
fits from the mountain spring to the lake. It stays calm inside sloughs and on the
lake, and slides along banks instead of running aground. Press `E` near a shore to climb out onto the
bank (further out, `E` does nothing). Anyone can climb into anybody's boat,
one rider to a boat. An unattended canoe also drifts with the river current. If you leave
the game or are knocked out on the water, the boat is put ashore and you are on
the bank. The rowing rules are in `packages/shared/src/sim/rowing.ts`, and the
boat under each rider is drawn by `apps/client/src/scene/rowing-boats.ts`. See
[decision 0093](docs/decisions/0093-rowing.md).
The rider stays seated above the local water at every elevation, and the timber
floor and closed underside remain visible. Existing saved rowboats become canoes.
Inspect it at `?gallery=canoe`; see [decision 0193](docs/decisions/0193-narrow-river-canoe.md).
Both hands grip the paddle through the stroke. The blade feathers clear during
recovery and settles into a raised resting grip when you stop paddling; current
alone does not keep the arms stroking. Other players use the same motion. Add
`&coast` or `&body=ranger` in the canoe gallery to inspect it. See
[decision 0194](docs/decisions/0194-hand-held-canoe-paddling.md).

If you are knocked out and your boat is left on an island, where you can't walk
back to it, it falls apart where it sits and you wake in bed free to build
another. It leaves half its materials (three logs and a rope) in a pile on the
island's shore for anybody to pick up. A boat on the mainland shore, one that
somebody else is rowing, and anybody else's boat are left alone. See
[decision 0094](docs/decisions/0094-boat-falls-apart.md).

In winter the lake freezes over, and you can walk on it. Nobody can climb into a
boat or moor a new one until spring, and nobody can cast a line onto the ice. A
boat that is out on the water when the ice comes freezes where it is, and
whoever was rowing it steps out onto the ice beside it. When spring comes the
boat floats again, and anyone still out on the lake is put on the nearest shore.
The server decides when it freezes and tells every browser; the ice is a pale
sheet drawn over the water. The rules are in `packages/shared/src/sim/seasons.ts`
(`lakeIsFrozen`) and `sim/world-sim.ts`, and the ice is drawn by
`apps/client/src/scene/lake.ts`. See
[decision 0095](docs/decisions/0095-lake-freezes-in-winter.md).

### Wind in the grass

Walking through the forest updates only tree instances whose detail slots change,
keeping unchanged trees and their bounds in place. See
[forest frame pacing](docs/decisions/0148-forest-detail-packing-work.md).

Nearby clearings and sunny forest patches now have moving grass blades, with
rolling gusts and a little flutter. Water, bare ground, spawn traffic, paths and
building footprints stay clear. The distant painted ground remains in place.
Settings → General includes a grass-density slider; zero turns blades off, and
reduced-motion preferences stop their wind animation.

Tufts differ from one another: unlike blades, every facing, mostly short with a
few tall, a slight lean, and colours from lush to dry, in patches. They shrink
smoothly into the ground at the far edge, with no popping or hovering as you
walk, and new ground is prepared a tile at a time so crossing into it does not
stutter. See [decision 0097](docs/decisions/0097-steadier-and-more-varied-grass.md).

### The map

A round minimap in the top right shows the land around you, turned so that
whatever is ahead of the camera is at the top, with your home and your stash
on it (pinned to its rim, pointing the way, once they're too far to show),
other players nearby, and everything you've built. Press `M`, or click it,
for the whole map: a field-journal page you can drag and zoom. It starts as
blank parchment and fills in as you explore, and it remembers what you've
seen from one visit to the next. It's painted from the world's own seed in
the background, a second or so after you arrive. See
[decision 0054](docs/decisions/0054-a-minimap-and-a-map-that-fills-in.md).

### Day and night

Moonlight shadows use a dim blue-grey fill so characters and ground details stay
readable beneath trees, including during blizzards. Daylight, torch light and
underground darkness keep their existing behavior. See
[readable moonlight](docs/decisions/0138-readable-moonlight-shadows.md).

The following daylight shadow map moves on whole texture pixels in light space,
reducing shimmering edges during small steps while retaining its coverage and
light direction. See [stable following shadows](docs/decisions/0142-stable-following-shadows.md).

A 20-minute day runs the whole time a world is awake, the sky and light
brightening and dimming smoothly between noon and midnight. It's the
server's own clock, so it never skips and it's the same moment for everyone
in the world; the HUD's "Time" row says which half you're in right now.
A lit campfire, a built lantern or a torch in hand are
real light now, casting a warm, flickering glow on what's nearby rather than
just looking lit, so it's worth having one of the three going before the sky
gets dark - and now more than a matter of taste: see [Danger](#danger) below
for what changes once night actually falls. The six fires nearest the
camera light the scene at once; any further ones still glow, but light
nothing round them. See
[decision 0027](docs/decisions/0027-a-day-and-night-cycle.md),
[decision 0047](docs/decisions/0047-a-torch-and-real-firelight.md) for the
firelight itself and
[decision 0062](docs/decisions/0062-tools-held-forward-and-firelight-without-a-freeze.md)
for why lighting one never freezes the game.

### Fire fuel and firewood

Indoor cooking fires and outdoor campfires need logs. Each log burns for ten real
minutes, up to five logs (50 minutes) per fire. Approach a fire to see its remaining
time and add a log from your pack. Adding fuel lights it; putting it out preserves
unused fuel. Lit fires keep burning while the world is empty. Cooking and warmth
stop when the fuel runs out. Unheated homes still shelter you from blizzard winds,
but need a fueled fire to restore body warmth.

Each cabin has a wood pile along its left wall: 20 logs for a cabin, 50 for a large
cabin. Every stored log is visible. Stand beside it to store logs from your pack or
take them back out. Carry wood indoors and add it to the fire yourself. Storage
survives reconnects and cabin upgrades. See
[decision 0188](docs/decisions/0188-fire-fuel-and-cabin-firewood.md).

### The seasons

The year turns round spring, summer, autumn and winter, six game days (two
real hours) to a season, so a full year takes eight hours. Like day and
night it runs off the server's clock, so everybody in a world sees the same
season, and each world starts its year on a different day so they are not all
in step. In the game the whole year is a ring round the minimap: 24 pieces,
one for each day, running clockwise from the top (spring first, then summer,
autumn and winter), each in its season's colour. Days gone are bright, today's
piece pulses gently and days to come are dim. A round badge outside the ring,
in the middle of the current season's quarter, shows its icon (a sprout, sun,
leaf or snowflake), and pointing at the badge or the ring says it in words
("Autumn · Day 3 of 6"). The front page and
the character screen have a bigger banner in the top-left corner with the
season's name and a line of advice, using the calendar the painted backdrop
follows (`?season=` works there too). Neither shows a year, because no world is
chosen on those screens and the game does not need one. The HUD's "Season" row
still says which day it is, for the tests. See
[decision 0110](docs/decisions/0110-the-season-banner.md).
For the last day and a half of a season the forest eases into the next one,
so it changes colour slowly rather than all at once: the grass turns gold in
autumn, the sky goes pale and cold in winter, and winter puts snow on the
ground, the grass and the trees.

Golden pollen drifts on summer days and snowflakes fall in winter. These fade
with the season transition. Spring petals and autumn leaf squares are disabled.
Snow falls more heavily during precipitation and replaces rain streaks in winter.
The bounded particle pools remain outdoors only and respect reduced motion
(`art/season-fall.ts` holds the rules, `scene/season-fall.ts` draws them).

Some winters now have a three-day blizzard: heavier, wind-driven snow, reduced
visibility and 22% slower outdoor walking. Winter ice remains throughout the
season. Footsteps leave impressions that gradually fill with snow.

Summer storms can strike trees with lightning. Flames spread to nearby trees
and wooden buildings, hurt nearby players, and burn out on their own. Trees
burn upward and darken over about 45 seconds (30–75 seconds by size), then fall
without loot and leave charred stumps until regrowth. Destroyed homes spill their chest contents and move
occupants outside. Leave space around homes to limit spread.

With a torch equipped, face a nearby tree and left click to ignite it. Winter
trees cannot ignite. Spring and autumn fires stay on that first tree, while dry
summer fires can spread just like lightning fires. Carrying a torch past a tree
does not ignite it. See
[decision 0187](docs/decisions/0187-seasonal-torch-ignition.md) and
[decision 0197](docs/decisions/0197-progressive-tree-fires.md).
Open `?gallery=tree-fires` to compare different tree sizes through a full burn.

On local and preview servers, join an empty test world with `?weather=blizzard`
or `?weather=storm` to try these events immediately (combine with `&world=` for
a separate test world). Storm lightning begins within 18 seconds; ignition is
probabilistic. These controls are ignored in production. See
[decision 0113](docs/decisions/0113-blizzards-and-wildfires.md).

Plant gathering now bends and lifts the picked flower, reed, berry or mushroom toward
the character's hand, with a soft rustle. Picking stays immediate and can be interrupted
by moving or fighting. Reduced motion skips the detached-plant effect. Inspect the
animation at `?gallery=harvesting` (`&at=0.32` freezes it, `&before` compares the old
presentation). See [tactile harvesting](docs/decisions/0232-tactile-harvesting.md).

Six new foraging colonies make woodland routes worth remembering: mushrooms beside
existing fallen timber and richer berry clusters in natural canopy gaps. Picked-clean
colonies return within their small home area after the normal wait. Nearby hints
explain the habitat and when it needs time to recover. Buildings can cover a colony;
it waits rather than growing through them. Inspect the reused plant models at
`?gallery=forage-habitats` (`&before` compares). See
[learnable foraging habitats](docs/decisions/0234-learnable-foraging-habitats.md).

The Food page now helps pack for an outing: compare meal roles, ingredient routes,
current supplies, packed servings and the active benefit. Fire panels include
**Prepare meals**, opening this page directly. Preparing packs food; eating starts
the ten-minute benefit and replaces any other special meal. Berry tea also adds
10 warmth during its active benefit, alongside its existing gathering bonus; warm
clothes and shelter still matter. Preview at `?gallery=meal-preparation`.
See [meal preparation](docs/decisions/0235-meal-preparation.md).

### Stories brought home

Open **C → Trophies** (also linked from **C → Home**) for the stories and real acquisition routes behind eight existing earned displays. A count tracks distinct kinds currently placed in your yard or inside your own home. Choose a ready keepsake to start ordinary outdoor placement; use **B** for indoor decoration. Hover an outdoor trophy within five metres to read its story. Reclaiming changes the current collection count, without erasing or granting an achievement. Preview the collection at `/?gallery=keepsakes` (`&before` for the previous recipe list).

### Make This Place Home

Open **C → Home** to turn your first tent into a working trailstead. Build three
projects in any order inside your home boundary:

- **Trail workbench:** refine tools outdoors; nearby visitors can use it too.
- **Trail pantry:** ten extra private slots. Left-click the chest within reach.
- **Kitchen garden:** three growing boxes. Open the Garden journal beside them,
  or click the boxes; plant one berry, mushroom or flower and harvest three after
  ten minutes while the world is awake.

The Home guide shows backpack materials and completed projects. You can keep
supplies in your home chest between trips, then withdraw them to build. Projects
persist with the world. Empty a pantry or harvest its crops before reclaiming it.
Cabin interiors retain their existing facilities.

Review the campsite at `/?gallery=homestead` (`&before` for the empty campsite),
or try the journal at `/?gallery=homestead&view=plan`.

Your yard reflects daily use: the pantry gains up to five generic wrapped parcels as slots fill (contents stay private), the workbench shows its connected owner’s current tool, and indoor and outdoor crops grow gradually over their existing ten-minute timer. Nearby visitors see the same saved garden and pantry dressing. Compare `/?gallery=homestead&empty` with `/?gallery=homestead`.

## The Old Cedar Stag

Open **C → Gear** to plan a hunt for the Old Cedar Stag. Broad hoofprints continue
northwest beyond the elk grove toward its refuge. This moss-colored quarry is
more watchful than ordinary elk and faster than a sprint: approach on foot,
pause when it watches, then close for a strike. Meals are useful preparation and
remain optional. A catch guarantees one hide; a full pack leaves a personal
pickup at the catch. One hide, two rope and four reeds make the rare
**Cedarstalker coat** by hand. Wear it from **Z** for +6 protection, +45 warmth and
**Quiet step**: prey notices your approach from 15% less distance. Hostile
creatures keep their normal detection. The hide and coat survive knockout.

Pin the upgrade goal from the guide to follow ingredients and the next step
while traveling. The pin is saved for that world on this browser; item counts
and equipment still come from the server. Preview `/?gallery=cedar-hunt` for the
reused elk/clothing models, or `/?gallery=cedar-hunt&view=plan&hide` for the guide.

### Wildlife

Rabbits, jackrabbits, foxes and elk now leave fresh ground tracks along their actual
routes. Follow the print direction and use the nearby freshness hint; rain and
snow erase tracks faster. Recent trails are shared with later arrivals, but do not
survive a world unloading. Existing woodland leads still point to encounter sites.
Preview the impressions at `?gallery=fresh-tracks` (add `&before` to compare).
See [fresh animal tracks](docs/decisions/0233-fresh-animal-tracks.md).

A few rabbits - soft-furred, long-eared, with a powder-puff tail - live at fixed spots
out in the wilderness. Left alone they amble about near home. Walk and pause to
approach quietly; sprinting is noticed farther away. Prey stops and turns to watch
before bolting, while point-blank surprises and predators still startle it immediately.
Backing off lets suspicion fade. See [quiet stalking](docs/decisions/0231-quiet-stalking.md) and
[decision 0018](docs/decisions/0018-a-rabbit-that-flees.md).

Catch one with the same swing that fells a tree - an axe, and a rabbit within
reach of it - and it pays out meat, which restores more hunger than a fish
since a catch takes an actual chase. A caught rabbit is back at its den,
ready to catch again, a minute later. See
[decision 0019](docs/decisions/0019-catching-wildlife.md).

A fox lives out there too, with real modeled art rather than a placeholder
shape. Like a rabbit, it watches an approach before fleeing if you get too close
and pays out meat the same way if you catch it. Left alone, though, it
roams wider than a rabbit does and sometimes chases one down itself - if it
catches one, that rabbit is gone until it respawns at its den, same as if
you had caught it yourself. A fox spooked by you mid-chase drops the hunt
and flees like any other prey. See
[decision 0035](docs/decisions/0035-a-fox-that-hunts-rabbits.md).

### Danger

A masked raccoon lives out there too, at its own fixed dens same as a
rabbit. Left alone it ambles about the same way - but get too close and,
unlike a rabbit, it does not run: it comes straight for you. Once it
catches up it stops and plants its feet for a moment before it swings; back
out of reach before that moment ends and it misses. Land three hits of your
own first, with the same axe, and it runs off with nothing to show for it.

Getting hit costs health, a new meter alongside hunger. Run it out and
you're knocked out - you wake up safe at home, if you have a cabin, or the
shared clearing otherwise, healed straight back up. See
[decision 0024](docs/decisions/0024-a-masked-raccoon-that-fights-back.md).

It notices you from much farther away once night falls - bolder in the
dark, the same as a real animal would be. Carrying a lit torch, or staying
close to a lit campfire or a built lantern, cancels that entirely: you're
noticed from exactly the same distance as by day. Nothing about an actual
fight changes at night - the same chase, the same wind-up, the same three
hits to fight it off - only how easily it notices you in the first place.
See
[decision 0049](docs/decisions/0049-raccoons-get-bolder-at-night-and-a-cache-compass.md).

A knockout buries half of what you were carrying - your axe and rod always
stay with you - right where you went down, and heals you fully same as
before. A small mound marks the spot; walk back to it and the HUD offers to
dig it up, the same as reaching for anything else on the ground. Nobody but
you can dig up your own cache. Only the most recent death is recoverable: dying
again permanently removes any older stash, including partially recovered
leftovers, even if the new death drops nothing. See
[decision 0198](docs/decisions/0198-latest-death-recovery.md).

A small compass appears on screen too, the moment you're not already
standing next to it: an arrow pointing the way, and how far, to the belongings
from your most recent death, if you have not yet dug them up. It turns as
you look around, so
it always points the real way regardless of which way you're facing, and it
disappears once you're close enough to dig - handed straight back to the
usual "press E" hint at that point. See
[decision 0049](docs/decisions/0049-raccoons-get-bolder-at-night-and-a-cache-compass.md).

Left `Ctrl` dodges - a quick roll of about four metres in whatever direction
you are holding, or straight back if you are holding nothing - and leaves
you untouchable for its first third of a second, so timed right it gets you
through a swing rather than only away from it. It gets you out of a stagger,
too. It needs a moment to recharge before it is ready again.
See [decision 0025](docs/decisions/0025-a-dodge-that-buys-you-a-moment.md).

Holding left click past a quick tap winds up a charged attack: about a
second with your arm wound back, slowed to a creep at a third of walking
pace. Release to sweep through two whirlwind turns. Nearby creatures
on every side take the existing charged damage once as the weapon passes them.
Both turns can connect with a new target reached while moving. The axe also
strikes every nearby standing trunk in its path, including behind you. Charging
still prevents running, jumping, dodging or blocking.
Once released, you can walk, sprint, jump and change direction while spinning;
movement keeps both rotations going, and dodging is available after the spin.
See [weapon contact sweeps](docs/decisions/0196-whirlwind-weapon-contacts.md).
Creep while charging and you turn to face the way you walk. Light axe swings
keep their forward tree selection, and a charged shovel still makes one aimed dig.
Skeleton charged attacks share the whirlwind, with their usual wind-up and
damage. See [charged whirlwind](docs/decisions/0191-charged-whirlwind.md) and
[moving whirlwind](docs/decisions/0195-moving-whirlwind.md).
See [decision 0026](docs/decisions/0026-a-charged-attack-that-finishes-the-job.md)
for the charge itself,
[decision 0059](docs/decisions/0059-creeping-through-a-charge.md) for
creeping through it, and
[decision 0050](docs/decisions/0050-wow-style-mouse-and-inventory.md) for
why it moved off the right mouse button, which now turns the camera
instead.

### Skeleton raids

Every four to six minutes you spend outdoors - twice as often at night - a
raid of one to three skeletons turns up about 35 metres away and comes for
you. Nights bring bigger groups. A war horn sounds, and a banner says how
many there are and which way to look ("Three skeletons, behind you"); after
that a counter at the top of the screen says how many are left, and they
show as red diamonds on the minimap.

There are four kinds - minion, rogue, warrior and mage - and they fight with
your own moves: the three-swing combo, the charged strike and the dodge
roll. Only one attacks you at a time while the others circle, and every
attack starts with a wind-up you can see, so a roll (`Ctrl`) or a step back
always answers it. The rogue is quick and rolls out of the way a lot; the
warrior is slow and tough, and a light swing does not stop it mid-attack,
though a charged strike does. A click swings at the nearest skeleton in
front of you, and a health bar shows over any skeleton that is hurt, close
or aimed at.

Skeletons out of sight get an arrow round your character, which turns red
and pulses while that one winds up to swing. When a blow lands, the screen
edges flash red with an arc on the side it came from, and badly hurt, the
edges beat red.

Go into your home and they wait by the door for a while, then give up.
Being knocked out ends the raid too. Each skeleton you beat leaves bones
behind, and has a 30% chance to drop the next housing blueprint you have not
learned. Right-click the loot, then click a blueprint in your inventory to
learn it permanently in this world. Learning does not award XP. How tough each kind is, how hard it hits
and how often raids come all live in
[`packages/shared/src/data/raiders.ts`](packages/shared/src/data/raiders.ts).
Their weapons are simple stand-in shapes for now. See
[decision 0063](docs/decisions/0063-skeleton-raids.md).

`local` runs and preview links raid every minute or so instead, set by
`WORLD_RAID_SECONDS` in
[`apps/game-server/wrangler.jsonc`](apps/game-server/wrangler.jsonc). Staging and
production use the real wait.

`WORLD_ALLOW_TEST_SEASON` is `1` in the same places (local runs, the browser tests
and previews) and unset on staging and production. It is what lets `?season=` in
the address set the season on the server, so you can see the lake frozen without
waiting for winter.

### Wearing gear

Press `Z` to open your character screen beside your pack. Your character stands
in the middle (drag to turn them) with a slot on each side: helm, upper body,
lower body, feet, hands, main hand and off hand. Drag a piece of gear from the
pack onto its slot, or right-click it in the pack, to put it on; it shows on
your character, and everyone else sees it too. Drag onto a slot that already has
something to swap the two. Right-click a worn piece, or drop it back on the pack,
to take it off. You cannot change gear in a fight. Whatever is in your main hand
is what you swing. To drop a piece of gear instead of wearing it, hold `Shift`
while you right-click. Gear changes your appearance and supplies Attack power,
Protection, Vitality (maximum health) and Warmth. Hover an item to see its own
bonuses and the change from what you currently wear. Only the active main-hand
weapon adds attack damage; clothing supplies protection and winter insulation.
See [decision 0183](docs/decisions/0183-complete-item-equipment-bonuses.md).

| Weapon or tool             | Attack power bonus |
| -------------------------- | ------------------ |
| Iron sword                 | +50%               |
| Hunting knife, refined axe | +25%               |
| Axe, refined fishing rod   | +10%               |
| Fishing rod, shovel, torch | +5%                |

Every garment supplies both Protection and Warmth. A steel helmet favors
protection; a bear hat and padded jacket favor warmth. Existing maximum-health
bonuses remain. Bonuses apply while equipped, with Protection capped at 40%,
maximum health at 150, and Warmth at 100. Ordinary winter needs Warmth 60;
blizzards need 80. A lit campfire or indoor shelter also restores body warmth.

`WORLD_ALLOW_TEST_GEAR` is `1` in the same places as `WORLD_ALLOW_TEST_SEASON`.
It lets `?gear=all` in the address start your pack with one of every piece, as far
as it fits, so you can try gear without finding any.

### Fishing

The opening pond allows wading along its shallow edge, just like the lake and
river. The sloping bed lowers your feet into the water; the deeper middle remains
blocked at the same 0.8 m depth limit as the lake.

The rod lies on the bank of the pond. Face the water - the pond or the lake -
and left click to cast. The
float bobs while fish nibble; when it goes right under, click. Too soon or too
slow and the fish gets away. Three kinds bite: perch, trout, and now and then a
golden carp.

You have a second to click from the moment the float goes under on your own
screen, however slow your connection. The server times it on your side of the
wire, from a flag your browser sets on everything it sends while it is showing
the bite. See [decision 0014](docs/decisions/0014-fishing.md).

### Crafting

Sticks are gathered by hand - no tool needed - from a couple of patches of
fallen branches in the clearing. Press `E` next to one, the same as picking
something up off the ground. A patch holds between two and six, one per
press, and looks emptier as you pick it. Picked clean, it grows back a few
minutes later somewhere else in the clearing (see
[Patches growing back](#patches-growing-back)), so it does not matter if
somebody else already grabbed the world's one axe or rod: you can still get
your own. Flower patches work exactly the same way; what flowers are for
lives in [Building](#building) below.

Press `C` to open the craft menu, then `1` to make an axe out of three sticks,
`2` to make a fishing rod out of two logs, or `3` to make a torch out of two
more sticks - a parchment page of recipes opens with the ingredients each one
needs and marks the ones you can afford right now, and `C` again closes it.
Building (`B`) opens the same kind of page, for campfires, cabins, flower
beds and lanterns instead. Finding the axe in the stump and the rod on the
bank still work exactly as before; crafting is another way to get one, and
needs a free slot for it once the ingredients are used up. The torch has no such
shortcut - crafting is the only way to get one - and it equips and shows in
your hand exactly like the axe and rod, casting real firelight for as long
as it's the one you have equipped. See
[decision 0017](docs/decisions/0017-crafting.md),
[decision 0040](docs/decisions/0040-a-bag-to-find-and-a-hotbar.md),
[decision 0043](docs/decisions/0043-a-field-journal-for-crafting-and-carrying.md)
and [decision 0047](docs/decisions/0047-a-torch-and-real-firelight.md) for
the torch itself.

### Cooking

A lit campfire is useful for more than light. Hold a perch, trout, golden carp
or piece of meat while standing beside one and press `E` to roast one piece.
The cooked version stays in your pack like any other food and restores more
hunger when eaten. If there is no room for the cooked result, nothing is lost
and the fire stays lit.

Raw food is still perfectly edible. Cooking is a useful reason to return to a
fire, not a punishment for eating on the trail. See
[decision 0064](docs/decisions/0064-cooking-over-a-campfire.md).

### Hunger

You get hungrier the longer you play. Press `E` and, if there is nothing at
your feet to pick up, you will eat whatever fish or meat you currently have
equipped - shown in your hand. Carrying other food that isn't equipped does
not help; press its own hotbar number instead, which equips and eats it in
the same press. Running out is a nudge, not a penalty: the HUD says so and
the hint turns urgent, but nothing worse happens yet. See
[decision 0016](docs/decisions/0016-hunger-and-eating.md) and
[decision 0045](docs/decisions/0045-an-item-has-to-be-active-to-use-it.md).

A full meter takes twenty minutes to run out for real. `local` runs and
preview links use three minutes instead, set by `WORLD_HUNGER_EMPTY_SECONDS`
in [`apps/game-server/wrangler.jsonc`](apps/game-server/wrangler.jsonc), the
same way tree regrowth is turned down. Staging and production use the real
wait.

### Trees growing back

The final axe blow tips a tree away from the cutter. After a brief fall, the
trunk breaks into individual logs. Walk up and press **E** to gather them,
just like sticks or flowers; chopping no longer puts wood straight in your
pack. The total yield is unchanged. Falling trees cause no damage and do
not block movement. Anyone can gather the logs, which fade after ten minutes.
The fall and its pending loot survive reconnecting. On ground contact, the
trunk settles with soft dirt billows, bark fragments and a low, distance-scaled
thump. The dust fades around the new log pickups.

Trying to collect a log, tool, stick or flower without room shows an
**Inventory full** notice with an **Open pack** shortcut and a short sound.
The item stays on the ground, and holding E does not repeat the warning.
All feedback sounds follow the sound-effects volume setting. See
[decision 0066](docs/decisions/0066-tree-landings-and-pickup-feedback.md) and
[decision 0065](docs/decisions/0065-falling-trees-and-fishing-input.md).

A felled tree comes back on its own, somewhere between half an hour and an hour
later, at a size of its own. It counts in real time rather than in ticks, so a
tree felled before bed is standing again by morning even though the world was
asleep the whole time. A tree will not grow back through somebody standing on
the spot; it waits until they move. See
[decision 0013](docs/decisions/0013-trees-growing-back.md).

Half an hour is a long time to wait while working on it, so `local` runs and
preview links use two minutes instead, set by `WORLD_REGROW_SECONDS` in
[`apps/game-server/wrangler.jsonc`](apps/game-server/wrangler.jsonc). Staging and
production use the real wait.

### Patches growing back

Nearby items must also be reachable through clear ground: steep banks and a
solid floor between you and surface loot block collection. Keyboard hints,
mouse explanations and server validation share this check; ordinary hops keep
the full horizontal reach. See [terrain-aware reach](docs/decisions/0143-terrain-aware-ground-item-reach.md).

A stick or flower patch picked clean is gone for three to six minutes, then
grows back with a fresh two to six, somewhere new in the clearing: never in
the pond, on a rock, on anything built, right where people arrive, or on top
of another patch. Everybody in the world shares the same patches, and an
empty one stays empty if you log out and come back, the same as a stump.
How many a patch holds and how far it keeps from things live in
[`packages/shared/src/constants.ts`](packages/shared/src/constants.ts). See
[decision 0061](docs/decisions/0061-patches-run-out-and-dropping.md).

`local` runs and preview links wait 30 to 60 seconds instead, set by
`WORLD_PATCH_REGROW_SECONDS` in
[`apps/game-server/wrangler.jsonc`](apps/game-server/wrangler.jsonc). Staging and
production use the real wait.

### Building

Press `C` to open a small menu of what you can place anywhere in the
clearing, then a number to pick one - or click it. A see-through preview of
it then follows your mouse across the ground, up to five metres from you,
with an outline of the room it needs: green where it fits, red where it
doesn't, and the hint along the bottom says why ("Too close to the Sitka spruce",
"Need 2 more logs"). Roll the mouse wheel to turn it, and click to place
it. A fence piece snaps onto the end of one you have already built, so a
line joins up cleanly and a corner comes out square - hold `Shift` to place
one freely instead. Everything keeps a little breathing room from trees,
rocks, the pond and other pieces, except fence pieces joined end to end and
garden path stones laid side by side. After placing a fence or a path
stone the preview stays out for the next, until you run out or press `Esc`
(or tap the right mouse button); anything you can only have one of puts
itself away once placed. See
[decision 0052](docs/decisions/0052-a-build-preview-that-follows-the-mouse.md).

- **Campfire** - four logs, exactly what felling the landmark spruce by the axe
  stump pays out. Real modeled art, and you can light it: press `E` once
  you're standing next to it for a genuinely animated fire. It burns for a
  while and goes out on its own, or put it out early by pressing `E` again.
  A lit fire casts real, flickering light on everything nearby, not just a
  flame that looks lit. Hold raw fish or meat beside a lit one and press
  `E` to roast one piece instead; cooked food restores more hunger.
- **Home** - one per player, upgraded in place: tent (6 sticks), teepee
  (8 sticks + 4 logs), small cabin (10 logs), larger cabin (20 logs + 8 sticks).
  A tent is known from the start; each upgrade requires its learned blueprint.
  Existing cabins stay small cabins and retain earlier building knowledge.
- **Flower bed** - six flowers, gathered by hand from a patch the same way
  as sticks. Capped at one per player.
- **Lantern** - four flowers. Also capped at one per player, independently
  of the flower bed - owning one never blocks the other. Always lit once
  built, casting the same kind of real, flickering light as a campfire, just
  smaller and closer - no switch, the same "atmosphere only" choice as the
  campfire's own fire.
- **Fence** - two logs a segment, and not capped: place as many as you can
  afford, one at a time, to actually line a boundary. A rustic split-rail
  fence.
- **Garden path** - two sticks a stone, gathered by hand the same way
  flowers are. Not capped either, for the same reason a fence isn't - a
  trail is only one stone if you can only ever place one.

What each one costs lives in
[`packages/shared/src/data/buildables.ts`](packages/shared/src/data/buildables.ts).

### Blueprint housing progression

The second entry in the Build journal always shows your next home tier. A new
home begins as a tent. After learning the appropriate blueprint, stand outside
near your home, choose the upgrade and click its preview. It remains fixed to
the original home position and heading. The server checks the larger footprint,
materials, ownership and that everyone has left the room before changing it;
a refusal keeps the materials and explains what prevented the upgrade.

Upgrades preserve the home ID, ownership, door lock, chest contents and exact
storage slots. The canvas shelters have travel beds and warm lanterns; the
teepee adds a table and chair. Cabins have the furnished log room and hearth;
the larger cabin expands the room and adds an exterior porch. Interiors use the
same tier dimensions for rendering, resting, doors and collision. Canvas roofs
lift away in the indoor view so they cannot hide the bed or chest.

Blueprint learning and pack consumption save together immediately. Character
knowledge lives in this world's SQLite database. Existing numeric item/build
IDs stay unchanged. See [decision 0073](docs/decisions/0073-learning-to-build-a-home.md).

### Your home

Walk into your home's entrance, or press `E` at it, and the screen fades
into the room inside: bigger than the outside suggests, seen from above like
a dollhouse with the near walls cut away. There's a bed, a stone hearth with
a real fire, a table and chair by the window with an oil lamp, a shelf of
books and jars, herbs drying from a beam and a braided rug. The fire and the
lamp glow brighter at night. Walk back into the door to go out.

Once you have a home, it's where you wake up: when you arrive, and after a
knockout, you're beside your own bed. A connection that drops and comes back
is not arriving, though: you carry on right where you were, and there is only
ever one of you in a world. Open the game in a second tab and that tab takes
over, while the first one pauses and offers to take you back. See
[decision 0057](docs/decisions/0057-one-of-you-per-world.md). Inside your own home, a button at the
top locks the door to visitors or opens it again. Anybody can visit an open
home, and only ever sees whoever else is inside with them. See
[decision 0055](docs/decisions/0055-going-inside-your-home.md).

Press `E` beside the chair to sit down at the table, or beside the bed to
lie down on it; walk, or press `E` again, to get up. Only one person fits in
each at a time. With food in your hand and room for it, `E` eats it first.
See [decision 0056](docs/decisions/0056-moves-with-weight.md).
See [decision 0020](docs/decisions/0020-a-campfire-you-can-build.md) for the
campfire and placement itself,
[decision 0022](docs/decisions/0022-a-cabin-of-your-own.md) for the cabin,
ownership and the spawn-at-home rule,
[decision 0023](docs/decisions/0023-decorating-the-garden.md) for the flower
bed, the lantern and the per-kind build cap,
[decision 0033](docs/decisions/0033-a-campfire-you-can-light.md) for the
campfire's real art, its animated fire and lighting it,
[decision 0047](docs/decisions/0047-a-torch-and-real-firelight.md) for the
real light the campfire and lantern both cast now, and
[decision 0048](docs/decisions/0048-a-fence-and-a-garden-path.md) for the
fence and the garden path stone.

### Storage chest

The chest beside your home's bed or bedroll holds ten stacks and is private to you.
Hover it for feedback and left-click when close enough to open it. Click a stack
to move it between your pack and the chest, or Shift-click to move one item.
Escape or the close button shuts the panel. The lid opens while you use it.

The server checks ownership, room, reach and available space for every transfer.
Only what fits moves; the rest stays where it was. Stored tools can be taken out
when your pack permits, while worn bags remain active pack upgrades. Contents
keep their slot positions after reconnecting or the world going to sleep, and
the pack and chest are saved together immediately after a transfer.

## Running it locally

You need [Node.js 24](https://nodejs.org) and [pnpm](https://pnpm.io).

```bash
pnpm install   # once
pnpm dev:web   # the whole game, on http://localhost:8787
```

`pnpm dev:web` runs it the way it is deployed: the game client served by the
Worker, talking to a real World Durable Object. **Open it in a normal window and
a private one to see two players.** Two tabs in the same browser are the same
player, so the newer one takes over from the older.

`pnpm dev` starts just the client, on http://localhost:5173, with hot reloading.
If it cannot reach a server it builds the clearing anyway and lets you walk about
offline, which is fine for working on how things look. Deployed clients wait for
the real world instead. During an outage, movement and actions pause with a
visible notice. Reconnection resumes after the server supplies your position;
release and press movement keys again to continue. Rejected joins stay visible
and offer a manual retry. See [reconnection](docs/decisions/0137-reconnection-input-and-feedback.md).
Repeated offline connection attempts keep journal navigation and fresh refusal
feedback responsive; stale gameplay is cleared when connection is lost or restored.
See [retry input](docs/decisions/0145-offline-retries-preserve-navigation.md).

To play against the deployed staging world, open its link. A local client can no
longer be pointed at another site's server: your login cookie belongs to one
site (see [decision 0086](docs/decisions/0086-sign-in-accounts.md)).

### Handy switches

Add these to the end of the URL:

| Switch             | What it does                                                                 |
| ------------------ | ---------------------------------------------------------------------------- |
| `?renderer=webgl2` | Force the WebGL 2 fallback, even where WebGPU works                          |
| `?world=some-name` | Join a different world                                                       |
| `?season=winter`   | See the world in that season, whatever the calendar                          |
| `?gear=all`        | Start with one of every piece of gear in your pack (local runs and previews) |
| `?gallery`         | Look at all of the game's own art, in daylight                               |

`?season=` also reaches the server on your own machine and on pull request
previews, where the first browser into an empty world sets its season, so the lake
freezes too. Use a new world name so nobody else is in it already, for example
`?world=winter-test&season=winter`. On the real game the switch only changes what
your own browser draws, and the server's seasons follow its own clock.

The gallery also includes `?gallery=tent`, `?gallery=teepee`, and
`?gallery=largeCabin`; `?gallery=home&tier=tent` (or another home kind) shows
the matching interior.

The gallery needs no server and skips the Home screen. `?gallery=cabin` looks
at one piece up close (also `fence`, `lantern`, `flowerBed`, `gardenPath`,
`buriedCache`, `bag`, `sticks`, `rabbit`, `raccoon`, `fox`, `campfire`, and
`pond`, `trees`, `rocks`, `stump`, `animals`, `ground`); add `&time=0.05` for
night or `&spin` to turn slowly round. `?gallery=home` shows the room inside
a home, on its own, and `?gallery=home&resting` has somebody sitting in the
chair and somebody lying in the bed. `?gallery=moves` plays every move a
character makes, over and over; `&demo=combo` (or `walk`, `run`, `chop`,
`strike`, `roll-forward`, `flinch`, `knockout`, `sit`, `lie`, `eat`,
`fishing` and so on) picks one, `&strip=7` lays it out as seven frozen
moments, and `&item=torch` (or `axe`, `rod`) puts that in every hand.
`?gallery=raiders` does the same for the skeletons: every kind's moves,
looping, with `&kind=warrior` (or `minion`, `rogue`, `mage`) for one of
them, and `&demo=` and `&strip=` as above. The moves gallery shows Body 1;
`&body=mage` (or another body's id) picks another. `?gallery=bodies` lines up
the six dwarf bodies with their own beards; `&beard=long` (or `braids`, `full`,
`stache`, `chops`, `none`) gives them all that beard, and `&motion=walk` or
`run` sets them moving.
`?gallery=bodies&tones` lines up every body in all five skin tones, and
`&skin=darker` (or another tone) gives the bodies that skin.

## Commands

Run these from the repository root.

| Command             | What it does                                               |
| ------------------- | ---------------------------------------------------------- |
| `pnpm dev`          | Start the game client with hot reloading                   |
| `pnpm dev:server`   | Start the world server locally                             |
| `pnpm dev:web`      | Start the Worker that serves the client and the API        |
| `pnpm check`        | Typecheck, lint, test, asset licences and build, in one go |
| `pnpm format:check` | Check formatting - the one thing `pnpm check` leaves out   |
| `pnpm typecheck`    | Check types in every package                               |
| `pnpm lint`         | Lint everything                                            |
| `pnpm test`         | Run every test                                             |
| `pnpm test:e2e`     | Play the game in a real browser (Playwright smoke tests)   |
| `pnpm build`        | Build everything for deployment                            |
| `pnpm check:assets` | Check every asset has a licence row                        |
| `pnpm bench:tick`   | Measure server tick time and memory with simulated players |
| `pnpm loadtest`     | Point a crowd of bots at a running world                   |

The pull request check runs both `pnpm check` **and** `pnpm format:check` as
separate steps - run both before pushing, since passing the first one alone
does not mean the second will too.

Worker walking fixtures wait for input acknowledgements and a stopped position
before reaching for loot, so a busy runner cannot carry a test player past the
bag or axe while the test reads an older snapshot.

`pnpm test:e2e` takes several minutes: one of the tests chops a tree down and
then waits for it to grow back, and another waits at the pond for a bite. It
runs the world in the `e2e` environment, where skeleton raids are put off for
a day so one cannot knock the test player out halfway through.

Gameplay tests skip the
actual drawing (they stop the browser sending triangles to the graphics card), because the browsers in
automated runs have no real graphics card and draw one frame every few seconds,
which makes a walking player crawl. The game logic is untouched. Tests
tagged `@real-drawing` still draw for real, so a broken renderer is still
caught. To see real pictures, for screenshots say, run with
`ACORN_E2E_DRAW=1 pnpm test:e2e` (see [decision 0100](docs/decisions/0100-browser-tests-skip-the-gpu.md)).

Gameplay specs share `e2e/fixtures.ts`; checks tagged `@real-drawing` and asset
galleries still paint their scenes. `SHOT_DIR` also preserves drawing for requested
screenshots. CI runs every case across eight independent shards, with one browser
per machine. All eight must pass the `Browser smoke tests` check, and failed shards
save separate traces and screenshots (see [decision 0131](docs/decisions/0131-reliable-browser-regression-checks.md)).

Package unit suites run on independent CI runners alongside static checks.
Preview, staging and production deploys use the verified client build from their
own workflow run after every suite passes (see [decision 0182](docs/decisions/0182-parallel-verification-before-deploy.md)).

## Repository layout

```
apps/client/        The game itself: Three.js, built with Vite
apps/web/           Worker that serves the client and the API
apps/game-server/   Worker that runs the World Durable Object
packages/shared/    Game rules both sides have to agree on
assets/             Art source files and LICENSES.csv
tools/              Asset scripts, load-test bots, benchmarks
docs/decisions/     Short notes on why things are the way they are
```

### Why two Workers

Cloudflare does not generate preview URLs for a Worker that implements a Durable
Object. Keeping the `World` Durable Object in `game-server` lets `apps/web` get a
preview link for every pull request. See
[decision 0001](docs/decisions/0001-two-workers-for-preview-urls.md).

## How the game is wired together

1. You press a key. The client moves you straight away, so it feels instant.
2. The client sends what you pressed to the server, 15 times a second.
3. The server simulates everyone 20 times a second and decides where everybody
   really is.
4. The server sends everyone's positions back 10 times a second. Other players
   are drawn a tenth of a second in the past so they glide instead of jumping.
5. If the server disagrees with where the client thought you were, the client
   quietly corrects itself.

The rules in step 1 and step 3 are the same code, in `packages/shared`. That is
why they agree.

## Environments

| Environment  | What it is                     | How it is deployed                |
| ------------ | ------------------------------ | --------------------------------- |
| `local`      | `wrangler dev` on your machine | —                                 |
| `e2e`        | `local` without skeleton raids | Started by `pnpm test:e2e`        |
| `staging`    | Where `main` lives             | Automatically, on merge to `main` |
| `production` | The public game                | Automatically, on a `v*` tag      |

Each environment has its own D1 database, R2 bucket and Durable Object namespace.

### Player accounts

Playing needs a Google or Discord account. A cookie remembers who is signed in
for a year, and each world keeps **one character per player** (made once, on
the Home screen, then final). Accounts live in a D1 database
(`acorn-ash-accounts-<environment>`) behind [Better Auth](https://better-auth.com),
and the web Worker tells each world which player is connecting. See
[decision 0086](docs/decisions/0086-sign-in-accounts.md) and
[decision 0087](docs/decisions/0087-one-character-per-world.md).

- **Test players.** Your own machine (`pnpm dev:web`), the browser tests and pull
  request previews can't use Google or Discord, so they have a "test player" that
  needs no login: automatic locally, a **Test sign-in** button on previews. The
  Worker only honours it on localhost and preview addresses, and the staging
  deploy checks it is off.
- **Database and session secret: nothing to do by hand.** Each deploy creates the
  environment's database, brings its tables up to date and gives the Worker a
  random session secret, using `tools/prepare-accounts.mjs`. It needs a Cloudflare
  API token with **D1: Edit** and **Workers Scripts: Edit** permission; if a deploy
  fails on that, the error says so.
- **Changing the tables:** edit `apps/web/src/accounts/schema.ts`, then run
  `pnpm --filter @acorn/web db:generate` and commit the new file in
  `apps/web/migrations/`. Never edit a migration that has already been merged.
- **Previews** share one throwaway database (`acorn-ash-accounts-preview`), so a
  branch never touches staging's players.

#### Setting up Google and Discord sign-in (once per environment)

Nothing is committed for this: the login credentials are secrets set by hand.
Until they are, the sign-in screen says signing in isn't switched on yet, and
the staging deploy prints a warning.

Each login service is told where to send people back to. For a Worker at
`https://<worker>.<your-subdomain>.workers.dev` that is
`https://<worker>.<your-subdomain>.workers.dev/api/auth/callback/google` (or
`.../discord`). Staging is `acorn-ash-web-staging`, production is
`acorn-ash-web-production`; add each one you use.

1. **Google.** In the [Google Cloud console](https://console.cloud.google.com/apis/credentials)
   make an _OAuth client ID_ of type _Web application_ and add the return
   addresses above under _Authorised redirect URIs_. Then, under _OAuth consent
   screen_ (Google Auth Platform), set the app's name and support email and
   **publish it** ("In production"), or only the people on its test list can
   sign in. The basic scopes it asks for (email and profile) need no review.
2. **Discord.** In the [Discord developer portal](https://discord.com/developers/applications)
   make an application, open _OAuth2_, add the return addresses under _Redirects_
   and copy the _Client ID_ and _Client Secret_.
3. **Cloudflare.** For each Worker (_Workers & Pages_, then the Worker, _Settings_,
   _Variables and Secrets_) add four values, and choose the type **Secret**, not
   Text, or the next deploy removes them: `GOOGLE_CLIENT_ID`,
   `GOOGLE_CLIENT_SECRET`, `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`. A service
   with only half its pair is left out. A Worker has to be deployed once before
   it appears there.

To try the real thing on your own machine instead, put the same four values in
`apps/web/.dev.vars` along with `TEST_SIGN_IN=off`, and add
`http://localhost:8787/api/auth/callback/google` (and `discord`) to the services'
return addresses.

Pull requests get a preview link in a comment on the pull request, and it is the
whole game: that branch's client **and** a world server built from that branch,
deployed as `acorn-ash-game-server-pr-<number>` and removed again when the pull
request closes. So anything in a pull request can be played before it is merged,
including changes to the game rules and the server. Each preview world starts
empty. See [decision 0011](docs/decisions/0011-a-world-server-per-pull-request.md).

### A red check that is not ours

A Cloudflare Worker can pick up a Git connection made in the Cloudflare web UI,
completely separate from the deploy pipeline in this repository. When that
happens, Cloudflare tries to build and deploy that Worker itself on every
commit, using settings that don't match how this monorepo is actually built,
and it fails every time, including on `main`. This has shown up twice: once as
a stray Worker named after the whole repository with nothing in the code to
match it, and once as a direct connection on `acorn-ash-game-server-production`
and `acorn-ash-web-production` themselves (found and disconnected 2026-09-24).

The tell, in the Cloudflare dashboard's **Workers & Pages** list: a Worker
deployed only through our GitHub Actions workflows just shows "View
deployments," with no commit message. One with a stray Git connection shows a
GitHub badge and a commit message instead — that's the one to check.

To stop it: Cloudflare dashboard → **Workers & Pages** → that Worker →
**Settings** → **Build** → disconnect the Git repository. Our own deploys
never use this feature, so disconnecting it is always safe and never affects
the game.

### Protected world resets

Use your existing **Manage items** administrator link, then **Worlds**. Only the
configured verified Google owner can open this page or call its APIs. Inspect a
world ID (the main world is `home-clearing`), close all game connections to that
world, then choose **Review full reset**. Check the displayed site and world,
acknowledge the deletion and type `RESET <world-id>` before the final button.

A reset erases characters, inventory, equipment, structures, storage, terrain
edits, collected loot and creature progress in that world. Accounts, the
site-wide item catalogue, the map seed and reset history remain. A two-minute,
one-use confirmation is bound to the world, site and administrator; any new game
connection invalidates it. The server rechecks the world is empty during the
atomic reset. Late events from older connections are ignored. There is no undo.

The old unauthenticated `reset-players` URL is retired and cannot perform resets.
This is a manual control; scheduled rolling resets are not enabled.
See [protected world administration](docs/decisions/0248-protected-world-resets.md).

When a world next wakes, buildings whose saved owner no longer exists are
removed, including their chests, gardens and indoor decorations. This cleans up
old playtest leftovers. Buildings belonging to saved characters and communal
objects remain; recently deleted characters still use their normal removal deadline.

The staging main world also has a one-time reset of all player-built structures,
including old pieces without a recorded owner. It clears chests, gardens and
indoor decorations alongside the structures, while keeping characters, packs,
trees and buried caches. The saved reset marker prevents future visits or
deployments from clearing newly built homes. This reset is disabled in production,
previews and local games, and does not apply to other staging worlds.

`/api/worlds/home-clearing/status` reports `players` (currently connected),
`savedCharacters` (characters still saved, including offline ones), and
`builtStructures` (placed structures still in storage).

## Assets and licensing

Every file under `assets/`, and anything served from R2, needs a row in
[`assets/LICENSES.csv`](assets/LICENSES.csv). The pull request check fails
without one, and the in-game credits page is generated from that file. See
[`assets/README.md`](assets/README.md) for the rules about where art may come
from.

Most of the game's own art is not a file at all: its textures are painted in
code while the world loads, and its cabin, fence, lantern, animals and the
rest are built in code from those painted parts (see
[`apps/client/src/art`](apps/client/src/art) and
[decision 0053](docs/decisions/0053-painted-textures-and-real-shapes.md)).
Nothing to download and nothing to license - all of it is this game's own.
That is how the art made so far works; new and replacement art is made in
Blender (below), one family of things at a time.

### Making art with Blender

New models and textures are made in Blender, with Claude driving it through the
Blender MCP. Because Blender is open on your computer, **art sessions run on
your computer**, in Claude Code there; a cloud session can't reach Blender and
will say so instead of faking it.

To start an art session:

1. Open Blender and start the Blender MCP connection from its side panel, the
   way you did when you set it up. Tick the libraries you want Claude to be able
   to search (Poly Haven, Sketchfab, Hyper3D Rodin).
2. Open Claude Code on your computer in this project's folder.
3. Ask in plain words, one thing at a time: "make a lower-poly woodpile that
   matches the trees" or "replace the lantern with a proper model". Claude shows
   screenshots as it goes, so you can steer it.

When you are happy, Claude saves the Blender file and the game-ready model into
[`assets/`](assets/), adds the licence rows, and opens a pull request with
before and after pictures. The How to test step opens the new piece in the art
gallery on the preview (`<preview link>/?gallery=<name>`).

The rules that keep it safe and legal (where models may come from, the
triangle limits, what goes in the licence rows) are in
[`assets/README.md`](assets/README.md) and in the "Making art with Blender"
section of [`CLAUDE.md`](CLAUDE.md). See
[decision 0105](docs/decisions/0105-art-is-made-in-blender.md).

The iron axe is built by a Python script in [`tools/art/`](tools/art/) that
Claude runs inside Blender, so a change is made in the script and the model
rebuilt. Its colours are painted on as vertex colours rather than a texture.
See it in the gallery with `?gallery=iron-axe`, and
[decision 0107](docs/decisions/0107-dwarves-built-from-scripts-with-vertex-colours.md)
for why. (The dwarves, Dorrin and Hilde, were built the same way and have been
deleted.) The six plain bodies and the gear lifted off their outfits were built
the same way, by `tools/art/plain_bodies.py`, and the six dwarf bodies that
replaced them by `tools/art/dwarf_bodies.py`. After re-exporting the dwarves,
refit the moves to them with
`node tools/retarget-dwarf-animations.mjs assets/animations/character.glb assets/characters/knight.glb assets/animations/dwarf.glb`;
a new move made in Blender for the dwarves goes straight into
`assets/animations/dwarf.glb` with `tools/add-animation.mjs`.

**This repository is public.** Never commit secrets, `.env` files, or art whose
licence forbids redistribution.

## Where things are written down

The wilderness has wooded terraces and graded trails from the clearing toward
the cedar bench, lake overlook and southwest mountain ridge. Follow the worn
forest floor east or south to find them. To inspect the actual landscape without
signing in, open `/?gallery=forest-trails`; its three viewpoint buttons, drag to
orbit and scroll to zoom make the elevation changes easy to review. See
[decision 0186](docs/decisions/0186-forest-terraces-and-contour-trails.md).

- [`docs/decisions/`](docs/decisions/) — why things are the way they are, one
  short page each.
- [Working art direction](docs/design/art-direction.md) and
  [visual audit](docs/design/visual-audit.md) — the cabin-to-forest quality
  standard, observed findings, and priorities for the presentation pass.
- [Field journal gameplay feedback](docs/design/field-journal-feedback.md) — contextual guidance and gain notices.
- [Field journal HUD](docs/design/field-journal-hud.md) — the approved paper,
  fir-green and copper treatment, with controlled desktop review coverage.
- [Field journal menus and icons](docs/design/field-journal-menus.md) — matching
  pack, crafting and equipment surfaces; inspect the painted item art at `/?gallery=icons`.
- [Field journal entry and settings](docs/design/field-journal-entry.md) — title,
  sign-in, character-entry and settings surfaces in the same visual direction.
- [Field journal home controls](docs/design/field-journal-home-controls.md) —
  object management, chest storage and door privacy controls.
- [Map, journey and fireside notes](docs/design/field-journal-map-and-journey.md) —
  matching world-map, loading, fire-fuel and cabin log-storage surfaces.
- [Complete painted icon catalog](docs/design/painted-icon-catalog.md) — all current
  items, buildables and matching HUD symbols, with size and contrast review.
- [`docs/phase-0-experiments.md`](docs/phase-0-experiments.md) — what we found
  out about WebGPU, running an ECS inside a Durable Object, and what 50 players
  costs.

## Roadmap

| Phase          | Goal                                                                      | Done when                                                                      |
| -------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| P0 Foundation  | Monorepo, CI/CD, test clearing, a capsule with WASD, World Durable Object | Merging to `main` deploys to staging, and two browser tabs see each other move |
| P1 First steps | Explore and gather                                                        | Chop a tree, log out, come back, and the stump is still there                  |
| P2 Survive     | Craft, eat, fish, hunt                                                    | A 30-minute session feels good                                                 |
| P3 Home        | Build and decorate a cabin                                                | The cabin looks the same the next day                                          |
| **P4 Danger**  | Combat, creatures, knockout and buried items                              | Nights feel tense but fair                                                     |
| P5 Together    | Multiplayer at scale                                                      | 50 bots plus 10 people in one world stay smooth                                |
| P6 Launch      | Polish and public release                                                 | Live and linked from itch.io                                                   |

Forest sounds follow the ground underfoot: soft grass, damp forest litter,
worn soil and indoor wood. Nearby trees carry occasional daytime birds and
quiet canopy rustles with directional sound. Sound effects settings also
control this atmosphere. The [Pacific Northwest tree direction](docs/art/pacific-northwest-trees.md)
recommends fir, cedar and spruce silhouettes for a future art pass.
River flow and waterfalls have a quiet, directional soundscape that grows as you
approach. Wind softens under canopy; cabins muffle the surrounding world and deep
tunnels quiet it. Frozen water suppresses the flowing-water layer. The soundscape
uses two bounded voices and stops immediately on pause, hidden tabs or muted
effects. Birds leave longer quiet stretches during rain and snow.

Footsteps now follow the visible rig's left/right contacts, with shallow-water,
snow and ice sounds and one landing event. Existing impact recordings preload
and reuse bounded voices; paused/hidden worlds stop old tails. Reduced motion
suppresses impact camera shake. See
[contact feedback](docs/decisions/0154-visible-contact-and-impact-feedback.md).

The woodland now uses Douglas-fir, western redcedar and Sitka spruce models.
Most trees are 10–21 metres tall, with a mature mix reaching 32 metres in the
clearing's tree line and wilderness. Taller trees take longer to fall;
their wood still drops within reach. Faraway trees use simpler meshes.

### Forest gameplay loop

The next playable stages are recorded in [the gameplay-loop roadmap](docs/gameplay-loop-roadmap.md).
Exploration skeleton encounters add trail wanderers, guarded ruins and night-only
patrols alongside existing raids. Nearby fighters who contributed damage get
independent protected housing-blueprint rewards. Each missed eligible kill raises
the chance from 30% by 15 percentage points, guaranteeing the sixth; progress and
reward ownership persist per character/world. See decision 0074. Art previews:
`?gallery=ruins` and `?gallery=patrolTrail`.

### Wildlife trails

Follow split elk hoofprints northwest, tiny raccoon pawprints southeast, or heavy
root furrows southwest. Nearby tracks offer a short hint. Observe the elk quietly
for a journal sketch, inspect the raccoon hollow for a personal supply cache, and
help defeat the woodland guardian to earn a branch-crowned home trophy.

Each living nearby guardian helper earns their own reward eligibility. Inspect the
hollow with E to collect it; a full backpack keeps the reward pending. These rewards
and journal entries persist per character in the current world. Place the trophy
from Build inside your private home area. Elk and friendly raccoon encounters are
separate from the existing hostile masked raccoons.

### Useful homes

Tent storage grows into teepee cooking, small-cabin workbenches, and a three-box larger-cabin garden. Use E at the cooker, C beside a workbench for improved tools, or click garden boxes to plant and harvest. Gardens grow during active world time and keep ready crops until collected. Only owners can tend them. Housing upgrades show their costs and use your backpack first, then your private chest; other crafting and building still use the backpack. See [housing facilities](docs/decisions/0076-housing-facilities.md).

### Expedition meals

Learn recipes through discoveries, then prepare one benefit for the trail: rations shorten dodge recovery, forest stew gently heals, and berry tea shortens hand-gathering recovery. Special meals can be eaten at full hunger. One benefit lasts ten connected minutes, pauses while disconnected, and is replaced by the next special meal. The active indicator appears above health; recipes and inventory descriptions explain the effects. See [meal preparation](docs/decisions/0079-meal-preparation-benefits.md).

### Gentle forest weather

Most outings have clear skies or drizzle, with short rain and occasional brief storms. Rain-fed mushroom clusters yield up to two mushrooms during rain and for six minutes afterward. Storms leave a few shared fallen logs and branches; dusk brings fireflies. Weather adds opportunities and atmosphere without survival penalties. See [forest weather](docs/decisions/0080-gentle-forest-weather.md).

### Make yourself at home

Click Decorate inside your home to place a cedar bench, timber table, woven forest rug, colored lantern, flower planter or earned trophy. Colored lanterns and planters also work outdoors inside your building area. Point at the floor, scroll to rotate, and click to place. The preview protects doors, waking spots and useful stations. Move pieces for free or pack them up to recover their materials; a full backpack keeps the piece intact. Visitors can admire decorations but only owners can rearrange them. See [private decoration](docs/decisions/0081-private-home-decoration.md).

Returning home closes the expedition loop: store building supplies with one chest button, prepare a meal and rest. Knockout recovery markers remain until recovery or the next death; dying again permanently removes the old stash. Digging takes only what fits in your backpack; leftovers remain safely buried and marked until that character dies again. Cabin windows brighten softly at night.

During a dodge, tap left mouse for an aerial spin slash or click right mouse for an immediate higher somersault slam. Both follow-ups keep momentum along the original dodge path while aiming the weapon independently. Movement resumes on landing; the slam hits harder and has longer attack recovery. Outside a dodge, hold left mouse for the normal charged attack. Right-click still loots or drags the camera; see Settings > Keybindings and [dodge follow-ups](docs/decisions/0083-dodge-follow-up-attacks.md).

Players can read a cedar expedition board beside their own home by standing at it and pressing `E` (or, from inside, by opening its page with the button on screen). Three optional outings match their housing tier; one can be active, with private saved progress and no expiry. Real gathering, fishing, timber work, skeleton contributions and landmark visits advance objectives. Claim all rewards at home when the backpack has room; completing three outings teaches a decorative trail pennant recipe.

The Craft menu is one page of the field journal that lists everything you can make by hand or place in the world, sorted into Tools, Food, Home, Camp & lighting, Garden & boundaries, Lake and Trophies. Tabs along the top show all of it or one kind at a time; the title and tabs stay put while the list scrolls, so a short screen never hides a recipe. Number keys 1–9 pick from the page you are looking at, and every entry can be clicked. Indoor decorations keep their own panel (the Decorate button inside your home), grouped into Furniture, Lighting and Finishing touches. See [one Craft menu](docs/decisions/0096-one-craft-menu.md).

Menu hotkeys retain press order even between frames. Panels return keyboard
focus and remember journal scroll position; Escape dismisses a slot menu or
active gear drag before its underlying panel. A short arrival fade never delays
input and yields to reduced motion. See
[menu lifecycle](docs/decisions/0153-menu-focus-scroll-and-press-order.md).

A crowned, moss-armored ruin sentinel guards the old ruin clearings. It can be fought solo; actual helpers increase its health, with stable character identity across reconnects. Nearby contributors receive protected materials and their existing housing blueprint roll. A first victory earns a personal placeable trophy that stays available if the backpack is full; subsequent victories award materials.

Fishing records belong to each character in its current world: illustrated species pages track catches and best lengths, including catches released from a full backpack. Ordinary fish stay relaxed; a hooked golden carp asks for two gentle clicks in broad steady windows, with input timing that waits for the browser to show the challenge. Fresh responses keep its quiet-browser fallback alive; an equipped rod aims at the water beneath the cursor rather than intercepting tree canopies. Five catches unlock a carved fish display; all three species unlock its golden collection variant. Both are original stat-free decorations with server-validated recipes, material costs and placement checks.

Remote respawn-sized relocations start fresh interpolation history instead of
drawing a character through intervening hills. Ordinary movement, falls and
modest corrections continue to blend. See
[remote relocation](docs/decisions/0141-discontinuous-remote-positions.md).

Summer pollen keeps its airborne world height and fades before recycling across a
wider area, so camera turns do not reveal a following patch. Preview it with
`?gallery=trees&season=summer&spin`; see [decision 0155](docs/decisions/0155-world-space-summer-pollen.md).

### Private item catalogue

The verified Google owner can open **Manage items** directly from the welcome or
new-character screen and the in-game character panel (Z), or visit `/admin`. Search the full catalogue, edit names,
plural names, descriptions, rarity and applicable equipment bonuses, then **Save
draft**. **Review & publish** shows the changes before publishing them to every
world on that site. Connected worlds update within 15 seconds. A stale tab cannot
overwrite a newer draft or publication; reload the draft to review it first.
Restoring an item's defaults also requires Save and Publish. The item model can
be rotated with dragging or arrow keys; Reset view restores its angle. Clear
filters resets the search and rarity filters without changing any draft edits.

Rarity is a displayed tier; changing it does not adjust drop chances. IDs, recipes,
wearable slots and saved inventories stay intact. Existing protection, maximum
health and warmth caps remain in force; publishing never heals players.

One-time setup in the Cloudflare dashboard: open the web Worker for the intended
environment (`acorn-ash-web-staging` or `acorn-ash-web-production`), choose
**Settings → Variables and Secrets → Add**, and create a **Secret** named
`ADMIN_OWNER_EMAIL` whose value is the owner's verified Google sign-in address.
Deploy the secret change, then sign in with Google. Do this independently for each
environment. Keep the address out of public configuration files. Missing secrets,
unverified addresses, other accounts and test sign-in all leave the editor locked.

### Inspecting polished trees

Open `/?gallery=tree-models&season=summer` to inspect all five forest species.
Evergreens retain their painted green needles, including low branches and distant
meshes. Winter snow settles on upper branch faces and clears with the seasonal thaw.
Use the species, shape, season, distant-mesh and trunk close-up controls;
drag to orbit and scroll to zoom. The tree builders in `tools/art/trees.py`
and `tools/art/deciduous.py` retain their Blender sources under `assets/trees/`.
After exporting, compress each model with
`node tools/import-model.mjs <export.gltf> <tree.glb> --keep-attributes`
so the runtime bark texture retains its UVs. Run
`node tools/check-pnw-trees.mjs` to check closed bark, texture coordinates,
pivots, heights and near/distant triangle budgets.

### Inspecting fire animation

The shared flame is authored by `tools/art/flame.py` in Blender, with editable
source at `assets/buildables/flame.blend`. Run `node tools/check-flame.mjs`
after exporting and compressing it. View `/?gallery=campfire&time=0.2`,
`/?gallery=home&time=0.2` and `/?gallery=tree-fires&at=22&time=0.2` to compare
small fires, the indoor hearth and a rising forest fire. The `at` setting
holds tree burn progress while its flames continue moving. Operating-system
reduced motion pauses flames and steadies firelight.

### Exploring Bonehollow

Bonehollow is a ruined skeleton settlement in the southeast forest, marked on the
map. Its gate, market, graveyard and bell hall house thirteen skeletons in four
independent groups. Bring equipment: residents remain active during daylight.
The surrounding wilderness encounters keep their existing behaviour.

Accept **The Last Bell of Bonehollow** from any home expedition board. Find the
settlement, help defeat six watch skeletons, then defeat the Captain of the Last
Bell at the northern hall. He attacks in two combinations followed by a charged
whirlwind, with longer combinations below half health. Return home to claim the
rare Last Watch helm (+10 Protection, +5 Vitality, +10 Warmth), three forest stews
and six iron ore, plus a bronze Last Bell keepsake. Place the keepsake inside or
outside your home from Build, move it, or reclaim it to your pack. Both the helm
and keepsake survive knockout. Progress and placed displays survive reconnecting.
Previously completed outings can be repeated to earn the keepsake.
Inspect the display at `/?gallery=winter-gear&gear=last-bell`.
The board always offers this outing alongside two rotating expeditions.
Watchtowers, spectral lanterns and the enlarged bronze bell mark the approach.
`/?gallery=skeleton-town&view=captain` gives a close look at the captain and helm.
Inspect the player reward with `/?gallery=winter-gear&gear=last-watch-helm`.

Open `/?gallery=skeleton-town` to inspect the settlement and its residents;
use the district selector, drag to orbit and scroll to zoom. Direct views include
`&view=gateway`, `&view=market`, `&view=graveyard` and `&view=bell-hall`.
The editable model is `assets/settlements/bonehollow.blend`. To rebuild the model
and matching shared collision boxes:

```sh
blender --background --threads 2 --python tools/art/skeleton_town.py -- /tmp/bonehollow.gltf
node tools/import-model.mjs /tmp/bonehollow.gltf assets/settlements/bonehollow.glb
pnpm exec prettier --write packages/shared/src/data/skeleton-town-solids.json
node tools/check-skeleton-town.mjs
```

### Woodland housing finish

Inspect `/?gallery=tent`, `/?gallery=teepee`, `/?gallery=cabin`, and
`/?gallery=largeCabin` for shaped canvas, cedar roofing and finished joinery.
The shared Blender kit keeps entrances, storage and terrain-fitting foundations
unchanged. Rebuild it with `blender -b --threads 2 --python tools/art/housing_details.py -- /tmp/housing-details.gltf`,
then `node tools/import-model.mjs /tmp/housing-details.gltf assets/housing/cabin-details.glb`.
Run `node tools/check-housing-details.mjs` to validate the exported modules.
Spring petals and autumn leaf squares no longer fall through the scene; snow and
summer pollen remain.

### Combat confirmation and the Last Bell payoff

Confirmed hits on skeletons give a small stationary ivory mark and a quiet impact;
defeating one turns the mark gold. Whirlwinds coalesce simultaneous feedback, while
existing flinches and camera settings remain in charge of motion. Live Bonehollow
captain defeat and expedition completion ring a bronze bell and show the next
objective or a return-home reward reminder. Loading an existing save does not
replay the celebration. The effects volume slider controls these sounds.

### Discovery cairns

Small weathered cairns hint at the forgotten camp, logging site, mushroom grove
and mossy shrine from the surrounding woods. Approach one to read a direction,
potential reward and relevant guard warning. The hint fades out of use once you
have discovered its destination; claim rewards by inspecting the actual site.
Animal tracking and immediate interactions retain priority. Cairns avoid water,
steep ground and existing trees, and share their collision with the server.
Inspect `/?gallery=forest-trails&view=clue` (add `&before` to compare).

### Equipment specialties

The traveler's tunic from the forgotten camp reduces hunger drain by 15% while
worn. A crafted winter jacket recovers warmth 25% faster beside a lit campfire or
fueled home fire; exposure and cold grace periods are unchanged. A hunting knife
found in buried treasure gives one extra meat when used as the active weapon for
a meat-bearing animal's finishing blow, if inventory space permits. Off-hand and
carried items grant no specialty. These fixed properties remain visible in item
tooltips and the admin player-facing preview even with custom descriptions.

### Woodland mushroom flushes

On the second and fifth days of spring and autumn, a shared mushroom flush can
appear around either the forgotten camp or mushroom grove. Up to three extra
clusters grow on clear ground for that game day. Nearby players see a short
foraging hint; use the normal gathering interaction to collect them for cooking.
These are ordinary mushrooms, with no exclusive reward or countdown. Harvests
persist across reconnects and do not refill through ordinary patch regrowth.
The next scheduled flush chooses its landmark and positions from the world seed.

### Regional adventures

Two additional outings rotate through every home expedition board, including tents:

- **Where the river begins:** follow the river uphill to the mountain spring,
  gather six mountain stone and three mountain iron ore. Claim a winter jacket
  and two forest stews at home. Mountain resources count when freshly gathered
  from their mountain patches, not when taken from storage or another player.
- **A supper by the lake:** explore the large northeastern lake, gather six reeds
  from its shore and catch three fish there. Claim leather boots and two berry teas.
  The opening pond and upstream river do not count. Choose an open-water season;
  winter ice prevents fishing.

Arrival can count from a safe bank or trail. Objectives can be done in any order,
progress saves across sessions, and rewards use the existing atomic home-board
claim. Bonehollow stays pinned as the third offer; these trips join the other two
rotating choices. Existing active outings and save IDs remain valid.

Dug terrain includes a sealed, dark-earth underside and perimeter so seams cannot
reveal the sky below the world. Rebuilt ground around dig mouths participates in
camera collision from both sides. Inspect pits and tunnels in `/?gallery=dug-ground`
and `/?gallery=dug-ramp`; orbit low around the opening and look up from within it.

The toolbar automatically fills empty slots with carried tools (including torches)
and food. Gathered materials, clothing and building supplies stay in the inventory;
players can still drag items onto the toolbar to pin them manually.

Fish held by characters and shown in the admin item viewer use distinct low-poly
perch, trout and golden carp silhouettes, with fins, gills and species markings.
Roasted fish retain those shapes with toasted colors. Inspect the models at
`/?gallery=fish` (perch/trout above, golden carp/roasted trout below).
Wildfire flames fade smoothly into their bases instead of showing flat opaque
edges against burning trees. Inspect a frozen close-up at
`/?gallery=tree-fires&at=22&close&still`; omit `still` to watch the flame animation.

Skeletons have an independent 25% chance to drop an inventory bag in addition to
normal loot. Bags can be collected with a full pack and add four slots each,
up to 24 total. Harvestable mature reeds
now grow along both banks throughout the river, avoiding falls, deep water and
slough basins. River beds use the usual regrowth timer and new IDs after the
existing pond and lake beds, so old worlds gain them without moving saved beds.

Skeletons can also drop the weapon they visibly carry: minions and rogues have a
5% chance, warriors and mages 3%, and sentinels and captains 2%. These independent
bonus drops do not replace bones, bags or clothing. Equip recovered weapons in the
main-hand slot from the character screen; the mage's staff uses melee attacks.

Home upgrade previews check existing indoor decorations against the next home's
built-in layout. A conflicting furnishing is named in the preview; move or pack
it up inside before retrying. Outdoor clearance failures retain their specific
reason, including standing in the larger footprint, rather than always reporting
that the home needs more space. Buried treasure is included in preview clearance
just as it is on the server. A refused upgrade spends no supplies.

Right-click a placed object to manage it. Owners can **Move** decorations without
paying again or **Pack up** indoor/outdoor decorations for all their original
building materials. Other structures offer **Dismantle**, returning half their
current building costs (rounded down). The menu lists the refund and asks for
confirmation; homes require typing `DISMANTLE`. Empty storage and indoor
furnishings, harvest crops, let remaining fire fuel burn out, and have everyone
leave before removing a home. Full inventories refuse reclamation without
changing the object. Movement and refunds are validated and saved by the server.

Snow on firs and other evergreen foliage now follows the visible branch surface,
with uneven patches on upward-facing needles and green undersides. Inspect near
and distant trees at `/?gallery=tree-models&kind=pine&season=winter`.
Cabin log stores reuse the existing timber bench model as a low shelf that stays
visible and solid when empty. Right-click the shelf to open log storage; walking
nearby no longer opens it. Close the panel or walk away to dismiss it. Small and
large cabins still hold 20 and 50 logs, with every stored log shown on the shelf.

Cabin windows now follow the fireplace: burning fuel lights the glass and its
outdoor glow; putting the fire out or exhausting fuel leaves dull glass. The
small and large cabin share this behavior. The desk lamp has been removed from
home interiors. Inspect the difference in the gallery with
`/?gallery=cabin&time=0.02` and add `&unlit` to put its fireplace out.
Fire and tree-impact effects rehearse behind the initial loading screen so their
first shaders and buffers are prepared before play. Campfires reuse their flame
instances when relit. Falling trees keep a conservative rotation bound instead
of repeatedly rescanning whole batches; unaffected distant tree transforms are
retained when a nearby tree falls.

Regrown trees now begin at 18% of their mature height and gradually grow to a
seeded, varied full size over roughly 24–36 real minutes. The existing stump wait
still applies before a sapling appears. Growth survives logout and catches up
while a world sleeps; trunks wait for nearby players to clear before expanding.
Chopping an immature tree drops neither logs nor sticks. Existing mature trees
remain mature. Inspect stages with `/?gallery=tree-models&kind=pine&growth=0`
(sapling), `growth=127` (half grown) or `growth=255` (mature regrowth).

Click a weapon in the pack or a pinned toolbar slot to equip it in the main-hand
gear slot. Worn weapons stay available in their pinned slots, so choosing a tool
and then drawing the weapon again works without moving gear back to the pack.
Weapon changes retain the normal server checks for combat, ownership and space.
Food now takes two uses: first hold it, then click or press its toolbar number
again to eat it. With raw food held, interact with a lit cooking fire to cook;
a second toolbar use deliberately eats it even beside a fire. At full hunger,
ordinary food is retained, while prepared meals can still grant their benefit.

Sunreach High Plains is the second named outdoor zone, on the northwestern
frontier of the existing world. Walk northwest from home and follow the cleared
Windbreak Pass into golden steppe, Amber Dunes and Crown Mesa. Travel stays in
the same world without loading or transferring your character. The zone name
appears below the minimap; explored landmarks also appear on the main map.

Plains jackrabbits flee quickly and provide meat. Sunreach coyotes are a modest
step up from the basic forest threat: four hits, 28 damage, a clear 0.8-second
wind-up and a 40-metre pursuit leash. They hunt jackrabbits while calm. This first
pass reuses the existing rabbit and fox figures at adjusted scales, pending
new Blender art. The existing home clearing, lake, river and Bonehollow keep
their terrain; forest IDs outside the new region and exploration saves remain
stable. New rocks are solid and grounded, and the pass stays clear of scenery.
Inspect `/?gallery=high-plains` and use the viewpoint buttons for the dunes,
pass and wildlife. Seasonal snow and blizzards still apply; clear plains have a
longer horizon than the dense forest.

Sunreach's **The Sunreach Survey** is always available at your home expedition
board alongside Bonehollow and a rotating everyday outing. Follow the northwest
pass to the ranger outpost, inspect its notes with E, follow the cairn clue into
Amber Dunes, and use a held shovel to uncover the survey vault. Clues and progress
are personal and saved. Return home for a bag, refined axe, leather boots and a
Sunreach survey pennant that can be placed indoors or around your home. The
pennant reuses the existing trail flag figure. Inspect the trail with
`?gallery=high-plains&view=survey` or `&view=vault`.

Equipment offers playstyle choices as well as stats. **Leather boots** shorten
dodge cooldown by 15% while worn, stacking with a trail ration without changing
roll distance or immunity. An active **iron sword** deals 20% extra damage to a
hostile creature recovering from an attack; repeatedly staggering a skeleton does
not create that bonus. These join the tunic's slower hunger drain, jacket's faster
fire-side warmth recovery and hunting knife's extra meat yield. Traits remain
visible in item descriptions, including with custom admin flavor text.

Creature fights reward reading their movement. Coyotes stalk briefly from
mid-range, crouch before biting and commit to their original target and direction.
Sidestepping behind a bite avoids it; another player cannot accidentally inherit
that bite. Skeletons commit late in their wind-ups and leave a reliable pause
after attacking (heavier enemies generally recover longer), allowing dodges and
iron-sword counters. Flinch escapes and group turn-taking remain in place.
Inspect held coyote poses in `?gallery=high-plains&view=tactics&pose=windup`
(or `pose=bite` / `pose=recovery`).

Pickup clicks have a short 250 ms grace period when an action or gathering
cooldown is about to end. They remain tied to the clicked item and still require
reach and backpack space. Holding E can gather repeatedly; eating requires a new
press, so finishing a patch cannot consume the food in your hand. Context prompts
match the actual inspection, pickup and cooking priority.

Wildlife follows quieter routines between encounters: rabbits pause to forage,
foxes sniff and elk graze between wander destinations. Small prey seeks a clear
spot beside nearby rock during rain, storms and blizzards. Danger interrupts these
pauses immediately. Wandering prefers dry, walkable ground, and small animals
collide with solid rocks and trees rather than passing through them.

Beyond Bonehollow, cairns lead southeast to Crownbreaker Hold (246, 212).
The Hollow King is a giant armored skeleton intended for 3–5 prepared players:
dodge his broad cleaves, leave the whirlwind's reach during its long charge,
and counter during recovery. At half health his combinations become more dangerous.
Recent contributors each receive personal rewards, including a wearable crown
and a First Bell relic to display at home. A full wipe resets him; victory starts
a saved 30-minute real-time respawn. Inspect the existing-art boss arrangement in
`?gallery=raiders&kind=hollowKing&demo=attack`.

The Hollow King carries **King’s Requiem**, an epic greatsword with +85% base
attack power and animated violet/cyan enchantment. Each recent contributor
receives a personal sword on victory, and it survives knockout. Its soul ribbons,
travelling blade light and rising sparks follow the weapon in the king’s hand,
the player’s hand, on the ground and in the admin preview. Inspect it at
`?gallery=kings-requiem` (`&before` shows the original watch greatsword).

Nearby outdoor adventurers now share compact health and rescue indicators. If an
ally is nearby when you are knocked out, they have 15 seconds to reach you: hold
**E** within arm’s reach for three seconds to help you up with 35% health. Moving,
being hit or releasing E interrupts the rescue. Your buried belongings stay where
you fell. Solo knockouts retain the usual quick return home. The Hollow King’s
cleave and full-circle whirlwind also have distinct ground and text warnings.

The **King’s Road** now leads from Bonehollow’s southern edge through two ruined
watchposts to **the Last Muster**, a broad gathering point outside the Hollow
King’s aggression range. Scouts give way to a mixed armored guard; both groups
can be escaped and neither is a mandatory gate. Cairns, pennants, worn earth and
brief location cues mark the route. Inspect the real scenery at
`/?gallery=crownbreaker`, or add `&view=muster` for the ground-level reveal.

Defeating the Hollow King now releases the souls of his watch in an eleven-second
victory sequence: expanding spectral rings, rising soul ribbons, golden motes,
a deep bell and fanfare, and the actual enchanted **King’s Requiem** floating
above the arena. A delayed epic reveal points contributors to their personal
spoils. Movement and camera control stay available throughout, with a quieter
static presentation for reduced-motion preferences. Replay it at
`/?gallery=king-victory`; add `&at=4.8` to inspect the reveal.

The Hollow King channels **Soul Storm** at 65% and 25% health. A seven-second
warning gives players time to reach one of three glowing wardstones or help a
fallen ally. Stand inside a teal shelter circle to avoid the five damaging
pulses; leaving the storm boundary is safe too. The King stops attacking while
channeling and becomes exposed for a short counterattack window afterward.
Shelter, damage and phase timing are server-authoritative. Replay the mechanic
at `/?gallery=king-storm`, or add `&at=8.5` to inspect the active storm.

### Before you take the trail

After choosing an outing at your home board, **C → Expeditions** offers preparation
suited to its objectives: bring the right tools, wear protection or winter layers,
pack food, leave room for discoveries, and recover before heading out. Winter
insulation advice follows the current weather, including blizzards. Optional meal
suggestions link to **Food**; **Review equipment** and **Check backpack** open the
existing panels. Your outing stays saved throughout. Preparation is advice and
never prevents leaving. Completed outings show their reward claim instead.
Compare `/?gallery=expedition-preparation&before` with
`/?gallery=expedition-preparation`, and use `&ready` for an equipped preview.

### Equipment swaps and spare tools

Swapping weapons or taking gear off uses actual free backpack slots. If an older
save contains a spare of something already worn, returning that worn item keeps
both copies safely, including after reconnecting. Each copy occupies its normal
slot. New world pickups count worn equipment toward existing item limits, and
blocked loot stays on the ground. Equipment refusal messages also appear during
play when using the toolbar or backpack.
