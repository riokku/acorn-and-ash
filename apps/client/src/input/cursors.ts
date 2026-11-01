import pointer from '../../../../assets/ui/cursor-default.png?url';
import loot from '../../../../assets/ui/cursor-loot.png?url';

/** Both illustrations put their targeting tip at the same CSS-pixel hotspot. */
export const GAME_CURSOR = `url("${pointer}") 3 3, auto`;
export const LOOT_CURSOR = `url("${loot}") 3 3, pointer`;
export const CURSOR_ART = { pointer, loot };
