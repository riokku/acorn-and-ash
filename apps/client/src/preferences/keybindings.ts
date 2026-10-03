/** A single reference for the game's fixed keyboard and mouse bindings. */
export const KEYBINDINGS = [
  {
    title: 'Getting around',
    bindings: [
      ['W A S D / Arrow keys', 'Walk'],
      ['Shift (hold)', 'Sprint'],
      ['Space', 'Jump'],
      ['Right mouse + drag', 'Turn the camera'],
      ['Left Ctrl', 'Dodge roll'],
    ],
  },
  {
    title: 'Gathering & survival',
    bindings: [
      ['Right mouse (tap)', 'Loot the item under your cursor; gather from a patch'],
      ['E', 'Pick up nearby loot, gather, dig up your stash, use a campfire, or eat equipped food'],
      ['E near a chair / bed', 'Sit / lie down; move or press E to get up'],
      ['Left mouse', 'Face your target; chop, fight, cast or hook a fish'],
      ['Left mouse (hold, release)', 'Charge a heavy attack'],
      ['Left mouse as a swing lands', 'Continue your attack combo'],
    ],
  },
  {
    title: 'Your pack & menus',
    bindings: [
      ['1–6 / Click a hotbar slot', 'Equip an item; eat it if it is food'],
      ['I / Bag button', 'Open or close your pack'],
      ['Drag an item to the hotbar', 'Pin it to that slot'],
      ['Drag from hotbar to pack', 'Unpin that slot'],
      ['Left mouse on your cabin chest', 'Open your private storage'],
      ['Click / Shift-click a storage stack', 'Move the stack / move one item'],
      ['Right mouse on a slot', 'Drop one, drop all, or destroy an item'],
      ['C', 'Open or close crafting'],
      ['B', 'Open or close building'],
      ['1–6 with a menu open', 'Choose a recipe or building piece'],
      ['M / Click the minimap', 'Open or close the map'],
      ['Escape', 'Close the current panel, or pause'],
    ],
  },
  {
    title: 'Building',
    bindings: [
      ['Left mouse', 'Place the preview'],
      ['Mouse wheel', 'Rotate the preview'],
      ['Shift with a fence', 'Place freely without snapping'],
      ['Escape / Right mouse (tap)', 'Cancel placement'],
    ],
  },
] as const;
