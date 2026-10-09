import type { DigRefusalReason, GearRefusal, SupportProblem } from '@acorn/shared';

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

/** What the game says while a mine support is in hand and the spot under the mouse will not take one. */
export function supportProblemText(problem: SupportProblem): string {
  switch (problem) {
    case 'taken':
      return 'There is already a support here.';
    case 'blocked':
      return 'Something solid is in the way here. Dig it out first.';
    case 'noFloor':
      return 'Needs solid ground under it. Point at the tunnel floor.';
    case 'noRoof':
      return 'Needs solid roof two metres above the floor. This tunnel is too tall or open to the sky.';
    case 'tooWide':
      return 'Too wide. A support fits a tunnel one metre wide with solid walls either side.';
  }
}

/** What the game says when a swing of the shovel makes no hole (decision 0114). */
export function digRefusalText(reason: DigRefusalReason): string {
  switch (reason) {
    case 'home':
      return "Can't dig here. This is your home clearing.";
    case 'water':
      return "Can't dig here. Too close to water.";
    case 'built':
      return "Can't dig here. Too close to something built.";
    case 'deep':
      return "Can't dig any deeper here.";
    case 'full':
      return "Can't dig here. This world has been dug up enough.";
    case 'nothing':
      return 'Nothing to dig there. Step forward into the hole to keep going.';
    case 'far':
      return 'Too far away to dig there. Step closer.';
    case 'packFull':
      return 'You found something, but your pack is full.';
    case 'notTunnel':
      return 'A support needs a tunnel one metre wide with solid ground above, below and either side.';
    case 'supportTaken':
      return 'There is already a support here.';
  }
}
