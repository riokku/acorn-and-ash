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
> slot. Press `I`, or click the new bag button, to see everything you're
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
**36 m** for a larger cabin. Open B or select a building piece to see a ground
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

Hover world loot to see its name, quantity, and whether you can reach or carry it.
A short right-click picks that specific item up; a drag still turns the camera.
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
| `E` beside a rowboat                 | Climb in (one rider to a boat); in a boat at a shore, climb out          |
| `E` at your expedition board         | Read the board on your doorstep; `E` again to put it away                |
| `W` `A` `S` `D`, `Shift` (in a boat) | Row (steer toward where you point), pull harder                          |
| `1`–`6`                              | Equip the hotbar slot - eats it too if it's food                         |
| `C` (or `B` outdoors)                | Open the Craft menu: everything you can make or place, on one list       |
| `1`–`9` (Craft menu open)            | Pick the entry with that number on the page showing (axe, rod, torch...) |
| `B` indoors                          | Decorate the room                                                        |
| Left mouse (piece picked)            | Place it where its preview stands                                        |
| Mouse wheel (piece picked)           | Turn it                                                                  |
| `Shift` (held, fence picked)         | Place it freely instead of joining it onto another fence                 |
| `Esc` or right mouse tap             | Put the piece away                                                       |
| `I`, or the bag button               | Open or close your pack                                                  |
| Right mouse on a pack or hotbar slot | Drop one, drop all, or destroy what's in it                              |
| `M`, or click the minimap            | Open or close the map                                                    |
| Walk into your door, or `E` there    | Go inside your home, or back out                                         |
| Left mouse (quick click)             | Aim on press; release to chop/fight; cast or hook on press               |
| Left mouse (click as a swing lands)  | Carry on into the next swing, up to three in a row                       |
| Left mouse (held, then released)     | Charge without a light swing; release to strike                          |
| Right mouse (held), then drag        | Turn the camera                                                          |
| Left `Ctrl`                          | Dodge roll                                                               |
| `Esc`                                | Close a panel, or pause                                                  |

There is nothing to land on yet, so a jump is a hop in place.

The mouse is free the rest of the time, the way it is in World of Warcraft:
click on a tree, an animal or the water and your character turns to face it,
and the same click chops, catches or casts. A fishing click never also swings
a weapon. Click the hotbar or your pack instead of only pressing a number. Only holding the right button and
dragging turns the camera - a left click never moves it. Your character
swings or casts whichever way it faces: the way you last clicked, or the way
you are walking. See
[decision 0050](docs/decisions/0050-wow-style-mouse-and-inventory.md) and
[decision 0051](docs/decisions/0051-a-click-turns-the-character-not-the-camera.md).

Your pack has six slots to start with. The bag, a few steps from where you
start, adds four more, for ten. A slot holds up to ten of one thing - logs,
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
underneath. It turns orange once every slot is taken. Press `I`, or click
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

The painting is alive and follows the seasons. Mist drifts, the lake glints,
smoke rises from the chimney, the cabin window glows and the camera moves very
slowly. In autumn the leaves turn gold and red and fall, in winter the trees go
frosty, the lake freezes and light snow falls, and in spring there is blossom.
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
character and a tint. All six characters from a free pack - Knight,
Barbarian, Mage, Ranger, Rogue and Rogue Hooded - now have real art and can
be picked, each walking, running and jumping for real rather than sliding
around as a placeholder capsule. Your name, tint and character travel to
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

Every move your character makes is a real animation now, from KayKit's free
Character Animations pack: three different swings in a row if you keep
clicking as each one lands, a crouch and a leaping two-handed slam for a
charged strike, a tumble for a dodge, a stagger when something hits you,
falling down when you're knocked out and getting back up, chopping at a tree
like a woodcutter, casting, waiting and reeling at the pond, bending down to
pick things up, digging with a shovel, lifting food to your mouth a bite at
a time, and sitting and lying down at home. Swift attacks keep your feet free to walk or run through the whole swing.
Charged strikes still plant your feet. Everybody else sees the same moves on you.

Blows land on the very moment the animation does, and feel like it: a brief
pause on the hit, a little camera kick, chips of wood flying out of a tree
as it shivers, tufts of fur off an animal as it's knocked back, a pale streak
behind the swing, a whoosh through the air, and dust where a charged strike
hits the ground. See
[decision 0056](docs/decisions/0056-moves-with-weight.md).

### The wilderness

Past the clearing's own ring of trees the ground rolls into hills, and the
forest thickens the further out you go, out to a wall 150 m from the centre.
It's generated from the world's seed, so the server and every browser draw
the same hills and the same trees without anything about them going over the
wire - the same trick the clearing itself already uses. Every tree out there
can be chopped down with the axe, exactly like the clearing's: the same number
of swings, a stump, logs to gather, and the tree grows back (see "Trees growing back"
below). See [decision 0015](docs/decisions/0015-wilderness-beyond-the-clearing.md)
for the forest itself and
[decision 0098](docs/decisions/0098-every-tree-can-be-chopped.md) for chopping it.

### The lake

In the north-east corner of the world, a good walk from home, there is a big
lake: about a hundred metres across, with five islands in it. It's the same in
every world. The ground slopes down to a gentle beach, the water goes from clear
green in the shallows to deep blue, and there are reeds, lily pads and stones
along the shore. You can't wade in: the shore holds you back, and you slide
along it if you walk at it on a slant. The islands, with their own trees and
rocks, are out of reach on foot: you reach them by rowboat. It shows on
the minimap and the big map. You can cast a rod onto the lake the same as onto
the pond (a cast never lands on an island). In winter the lake freezes over: see
[Rowboat](#rowboat) below. The code is in
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
reeds into a length of rope, by hand with no workbench. Rope is for the rowboat,
below, which is for the lake only.

The places are worked out in `packages/shared/src/world/reeds.ts` and drawn in
`apps/client/src/scene/reed-models.ts`. `local` runs and preview links bring a
bed back in 45 to 75 seconds instead, set by `WORLD_REED_REGROW_SECONDS` in
[`apps/game-server/wrangler.jsonc`](apps/game-server/wrangler.jsonc). See
[decision 0091](docs/decisions/0091-reeds-and-rope.md),
[decision 0099](docs/decisions/0099-mature-reeds.md) and
[decision 0101](docs/decisions/0101-reeds-at-every-water.md).

### Rowboat

With six logs and two rope, open the Craft menu (`C` or `B`) and pick **Rowboat** on
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
round, and `Shift` pulls harder. Let go and it glides to a stop; it never runs
aground, it slides along the bank. Press `E` near a shore to climb out onto the
bank (further out, `E` does nothing). Anyone can climb into anybody's boat,
one rider to a boat, and a boat you leave stays where you left it. If you leave
the game or are knocked out on the water, the boat is put ashore and you are on
the bank. The rowing rules are in `packages/shared/src/sim/rowing.ts`, and the
boat under each rider is drawn by `apps/client/src/scene/rowing-boats.ts`. See
[decision 0093](docs/decisions/0093-rowing.md).

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

Each season also fills the air with its own thing: blossom petals in spring,
drifting golden pollen on summer days, falling leaves in autumn and snowflakes
in winter. They fade in over the last day and a half of the season before and
fade out over the last day and a half of their own, so the first leaves fall
while it is still summer. Wind makes the leaves come thicker, and snow falls
more heavily when it is also raining. In winter the snow takes the place of
the rain streaks. They are a small fixed pool that follows you, so they cost
almost nothing; they stay outdoors only, and nothing falls if your computer
asks for reduced motion (`art/season-fall.ts` holds the rules,
`scene/season-fall.ts` draws them).

So far the seasons only change how the world looks; what each season changes
in play (what you can gather, which fish bite, how creatures behave) comes
next. See [decision 0089](docs/decisions/0089-seasons.md).

### Wildlife

A few rabbits - soft-furred, long-eared, with a powder-puff tail - live at fixed spots
out in the wilderness. Left alone they amble about near home; get too close
and one bolts, curving away for as long as you keep following. See
[decision 0018](docs/decisions/0018-a-rabbit-that-flees.md).

Catch one with the same swing that fells a tree - an axe, and a rabbit within
reach of it - and it pays out meat, which restores more hunger than a fish
since a catch takes an actual chase. A caught rabbit is back at its den,
ready to catch again, a minute later. See
[decision 0019](docs/decisions/0019-catching-wildlife.md).

A fox lives out there too, with real modeled art rather than a placeholder
shape. To you, it is just another rabbit: it flees the moment you get close
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
you can dig up your own cache. See
[decision 0028](docs/decisions/0028-buried-items-after-a-knockout.md).

A small compass appears on screen too, the moment you're not already
standing next to it: an arrow pointing the way, and how far, to the nearest
thing you have buried and not yet dug up. It turns as you look around, so
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

Holding left click past a quick tap winds up a charged attack - about a
second with your arm wound back, slowed to a creep at a third of walking
pace - then leaps forward into a slam. Whatever it lands on when it goes off is finished
outright: a tree falls in one regardless of how many ordinary swings it
would otherwise take, and a raccoon is beaten in one regardless of how many
hits it has left. It is a real trade - you can only creep, and cannot run,
jump, dodge or block while charging - so it suits a decisive moment more
than a running fight. Creep while charging and you turn to face the way you
walk, so the slam lands that way.
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

### Fishing

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

Press `B` to open a small menu of what you can place anywhere in the
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
offline, which is fine for working on how things look.

To play against the deployed staging world, open its link. A local client can no
longer be pointed at another site's server: your login cookie belongs to one
site (see [decision 0086](docs/decisions/0086-sign-in-accounts.md)).

### Handy switches

Add these to the end of the URL:

| Switch             | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `?renderer=webgl2` | Force the WebGL 2 fallback, even where WebGPU works |
| `?world=some-name` | Join a different world                              |
| `?season=winter`   | See the world in that season, whatever the calendar |
| `?gallery`         | Look at all of the game's own art, in daylight      |

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
them, and `&demo=` and `&strip=` as above.

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

`pnpm test:e2e` takes several minutes: one of the tests chops a tree down and
then waits for it to grow back, and another waits at the pond for a bite. It
runs the world in the `e2e` environment, where skeleton raids are put off for
a day so one cannot knock the test player out halfway through.

The older tests in `e2e/play.spec.ts`, and the reeds and rowing tests, skip the
actual drawing (they stop the browser sending triangles to the graphics card), because the browsers in
automated runs have no real graphics card and draw one frame every few seconds,
which makes a walking player crawl. The game logic is untouched. Two tests
tagged `@real-drawing` still draw for real, so a broken renderer is still
caught. To see real pictures, for screenshots say, run with
`ACORN_E2E_DRAW=1 pnpm test:e2e` (see [decision 0100](docs/decisions/0100-browser-tests-skip-the-gpu.md)).

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

### Starting a world's players over

Visiting `/api/worlds/<worldId>/reset-players?confirm=clear-everyone` clears
every saved player's pack, hunger, health, position and name for that one
world, and lets the one-time pickups (the axe, the bag, the rod) be found
again - a clean slate for testing, not something reachable from inside the
game itself. It leaves everything else about the world alone: built props,
felled or regrown trees and buried caches are untouched. Refuses if anyone
is currently connected to that world - close every tab in it first. For
staging's default world, that's
`https://acorn-ash-web-staging.chrisistinson.workers.dev/api/worlds/home-clearing/reset-players?confirm=clear-everyone`.
See [decision 0042](docs/decisions/0042-hotbar-icons-and-a-way-to-reset-testing.md).

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

The dwarves (Dorrin and Hilde) and the iron axe are built by Python scripts in
[`tools/art/`](tools/art/) that Claude runs inside Blender, so a change is made
in the script and the model rebuilt. Their colours are painted on as vertex
colours rather than a texture. See them in the gallery with `?gallery=dwarves`,
and [decision 0107](docs/decisions/0107-dwarves-built-from-scripts-with-vertex-colours.md)
for why.

**This repository is public.** Never commit secrets, `.env` files, or art whose
licence forbids redistribution.

## Where things are written down

- [`docs/decisions/`](docs/decisions/) — why things are the way they are, one
  short page each.
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

Press B inside your home to place a cedar bench, timber table, woven forest rug, colored lantern, flower planter or earned trophy. Colored lanterns and planters also work outdoors inside your building area. Point at the floor, scroll to rotate, and click to place. The preview protects doors, waking spots and useful stations. Move pieces for free or pack them up to recover their materials; a full backpack keeps the piece intact. Visitors can admire decorations but only owners can rearrange them. See [private decoration](docs/decisions/0081-private-home-decoration.md).

Returning home closes the expedition loop: store building supplies with one chest button, prepare a meal and rest. Knockout recovery markers never expire. Digging takes only what fits in your backpack; leftovers remain safely buried and marked, including in long-lived worlds with many caches. Cabin windows brighten softly at night.

During a dodge, tap left mouse for an aerial spin slash or click right mouse for an immediate higher somersault slam. Both follow-ups keep momentum along the original dodge path while aiming the weapon independently. Movement resumes on landing; the slam hits harder and has longer attack recovery. Outside a dodge, hold left mouse for the normal charged attack. Right-click still loots or drags the camera; see Settings > Keybindings and [dodge follow-ups](docs/decisions/0083-dodge-follow-up-attacks.md).

Players can read a cedar expedition board beside their own home by standing at it and pressing `E` (or, from inside, by opening its page with the button on screen). Three optional outings match their housing tier; one can be active, with private saved progress and no expiry. Real gathering, fishing, timber work, skeleton contributions and landmark visits advance objectives. Claim all rewards at home when the backpack has room; completing three outings teaches a decorative trail pennant recipe.

The Craft menu is one page of the field journal that lists everything you can make by hand or place in the world, sorted into Tools, Food, Home, Camp & lighting, Garden & boundaries, Lake and Trophies. Tabs along the top show all of it or one kind at a time; the title and tabs stay put while the list scrolls, so a short screen never hides a recipe. Number keys 1–9 pick from the page you are looking at, and every entry can be clicked. Indoor decorations keep their own panel (`B` inside your home), grouped into Furniture, Lighting and Finishing touches. See [one Craft menu](docs/decisions/0096-one-craft-menu.md).

A crowned, moss-armored ruin sentinel guards the old ruin clearings. It can be fought solo; actual helpers increase its health, with stable character identity across reconnects. Nearby contributors receive protected materials and their existing housing blueprint roll. A first victory earns a personal placeable trophy that stays available if the backpack is full; subsequent victories award materials.

Fishing records belong to each character in its current world: illustrated species pages track catches and best lengths, including catches released from a full backpack. Ordinary fish stay relaxed; a hooked golden carp asks for two gentle clicks in broad steady windows, with input timing that waits for the browser to show the challenge. Fresh responses keep its quiet-browser fallback alive; an equipped rod aims at the water beneath the cursor rather than intercepting tree canopies. Five catches unlock a carved fish display; all three species unlock its golden collection variant. Both are original stat-free decorations with server-validated recipes, material costs and placement checks.
