# Acorn & Ash

A cozy, third-person survival game that runs in the browser. You live in a
stylized low-poly forest: gather, hunt, fish, fend off creatures, and build a
cabin you can upgrade and decorate.

The game is online-only. Every world runs on the server.

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
> enough logs and you can build a campfire, or a cabin of your own - once you
> have one, that is where you start next time, instead of the open clearing.
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

## Controls

The in-game guide lives in **Settings → Keybindings**, on the Home screen or
while paused. Exploration keeps contextual action and danger prompts, with no
persistent movement or building tutorial. These are the current fixed bindings.

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
| Right mouse on world loot (tap)      | Pick up the clicked item or gather one from a patch                      |
| `E`                                  | Pick up nearby loot, gather, dig up a cache, use/cook at a campfire, eat |
| `E` beside your chair or bed         | Sit down or lie down (move, or `E` again, to get up)                     |
| `1`–`6`                              | Equip the hotbar slot - eats it too if it's food                         |
| `C`                                  | Open the craft menu                                                      |
| `1` / `2` / `3` (craft menu open)    | Craft an axe / fishing rod / torch                                       |
| `B`                                  | Open the build menu                                                      |
| `1`–`6` (build menu open)            | Pick a campfire, cabin, flower bed, lantern, fence or path               |
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
wire - the same trick the clearing itself already uses. Nothing out there can
be chopped or picked up yet; it's somewhere to walk, for now. See
[decision 0015](docs/decisions/0015-wilderness-beyond-the-clearing.md).

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
Being knocked out ends the raid too. Each skeleton you beat leaves a bone
behind - press `E` to pick it up. How tough each kind is, how hard it hits
and how often raids come all live in
[`packages/shared/src/data/raiders.ts`](packages/shared/src/data/raiders.ts).
Their weapons are simple stand-in shapes for now. See
[decision 0063](docs/decisions/0063-skeleton-raids.md).

`local` runs and preview links raid every minute or so instead, set by
`WORLD_RAID_SECONDS` in
[`apps/game-server/wrangler.jsonc`](apps/game-server/wrangler.jsonc). Staging and
production use the real wait.

### Fishing

The rod lies on the bank of the pond. Face the water and left click to cast. The
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
- **Cabin** - ten logs, one slot's worth. Capped at one
  per player. A little log cabin, with a shingled roof, a stone chimney, a
  window glowing warm and a woodpile by the wall - and you can go inside
  (see below).
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

### Your home

Walk into your cabin's front door, or press `E` at it, and the screen fades
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

To play against the deployed staging world:

```bash
VITE_GAME_SERVER_URL=https://acorn-ash-web-staging.chrisistinson.workers.dev pnpm dev
```

### Handy switches

Add these to the end of the URL:

| Switch             | What it does                                        |
| ------------------ | --------------------------------------------------- |
| `?renderer=webgl2` | Force the WebGL 2 fallback, even where WebGPU works |
| `?world=some-name` | Join a different world                              |
| `?gallery`         | Look at all of the game's own art, in daylight      |

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
