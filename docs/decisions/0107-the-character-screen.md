# 0107 · The character screen shows your character off

## Context

Chris wanted the screen before the game to feel like the one in World of Warcraft: your own character standing there in a slightly animated stance, in front of the painted valley, and an **Enter World** button. Settled with him: the character stands in front of the same painting as the front page (decision 0106), a drag turns them, a click makes them do a little flourish, and a player has one character per world (decision 0087), so there is one to show off, not a row to choose from.

## Decision

- **The real character, on a screen of its own.** `character-stage.ts` is a small Three.js scene with its own renderer on its own see-through canvas laid over the painting. It draws the same character the game draws (`createCharacter`, the same models and moves), standing in the game's idle stance, so what you see is what you will play, and the models are already loaded when the game starts. The game's own canvas is left alone until the player goes in.
- **Two layouts, one stage.** While making a character (wide window) they stand on the left, tinted and renamed as you type, with the card on the right. When welcoming a player back they stand in the middle of the painting with a small plate underneath: name, kind, **Enter World**. On a narrow window they stand above the card. `frame()` in `showcase.ts` puts the camera where the page asks (how far across, how far up, how much of the height) and backs away if the window is too narrow for them.
- **Drag to turn, click for a flourish.** A drag turns them with the front towards the way you drag (560 pixels is one full turn). A short, still press is a click and gives the next flourish in turn: a hop, a reach, a pick-up (the game's own hand moves). Pressing again while one plays does nothing. The arrow keys turn them and Space or Enter gives a flourish, for anyone without a mouse.
- **The rules are plain numbers.** `showcase.ts` holds the turning, the click test, the flourish rota, the framing and the frame budget with no Three.js in it, with unit tests. The stage only draws what it says.
- **It gives way first.** Like the backdrop, the stage times its frames. A computer that keeps struggling is given a less sharp picture, then a held pose that is only redrawn when something changes. With "reduce motion" on they hold their pose from the start; a click still gives a flourish, because the player asked for it. The stage does not draw while the tab is hidden.
- **If it cannot draw, nothing else breaks.** A browser that cannot give the stage a drawing surface leaves the canvas empty (`data-state="unavailable"`) and the rest of the screen, including **Enter World**, works as before.
- **Words.** The button now says **Enter World** whether you are new or coming back, instead of "Enter the clearing as …".
- **Browser tests** read what the stage reports on its canvas (`data-state`, `data-character`, `data-tint`, `data-turn`, `data-flourishes`) and still use `skipDrawing` (decision 0100); one `@real-drawing` test checks the character really is on the screen.

## Consequences

- The character screen now draws a second 3D scene before the game's own. It is one small model and runs only while the screen is up; the stage is taken down when the player goes in.
- A new character model or move shows up here without extra work. A new flourish is a line in `FLOURISHES`.
- The character stands empty-handed. Showing what they carry (axe, rod) would be a later, separate change.

## Update · 2026-10-07: smaller and centred

Chris asked for the character to be about half the size and for the content to sit in the vertical middle of the screen.

- **Half the size.** The character fills a third of the window's height while a new one is made, and a quarter on the welcome-back screen (they were 64% and 50%).
- **Centred.** While making one, the character stands level with the card, which is centred, and their name hangs just under their feet. On welcome-back, the title, the character and the plate are one column centred from top to bottom, instead of the title at the very top and the plate at the very bottom. The character fills an empty slot in that column; `useSlotPlacement` measures the slot and `placementOfBox` (in `showcase.ts`, unit tested) turns it into where the stage stands, so it stays right at any window size or title height.
- **The front page** loses its small "Acorn & Ash" mark in the upper left, which repeated the big title below it.
