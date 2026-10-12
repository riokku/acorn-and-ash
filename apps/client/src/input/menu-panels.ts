/** The character screen shares its pack; all other central panels stand alone. */
export type MenuPanel = 'pack' | 'character' | 'map' | 'journal' | 'decorations';

export function menuPanelState(panel: MenuPanel | null) {
  return {
    inventoryOpen: panel === 'pack' || panel === 'character',
    characterOpen: panel === 'character',
    mapOpen: panel === 'map',
    craftMenuOpen: panel === 'journal',
    buildMenuOpen: panel === 'decorations',
  };
}
