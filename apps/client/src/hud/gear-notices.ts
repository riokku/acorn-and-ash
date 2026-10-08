import type { GearRefusal } from '@acorn/shared';

/** What the game says when the server turns a change of gear down (decision 0113). */
export function gearRefusalText(reason: GearRefusal): string {
  switch (reason) {
    case 'inCombat':
      return "You can't change gear while fighting.";
    case 'busy':
      return "You can't change gear right now.";
    case 'noRoom':
      return 'Your pack is full. Make room first.';
    case 'wrongSlot':
      return "That doesn't go there.";
    case 'missing':
      return "You don't have that any more.";
  }
}
