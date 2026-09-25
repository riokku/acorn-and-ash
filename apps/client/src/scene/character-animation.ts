/**
 * Which named clip a moment of movement should show. Kept apart from
 * character.ts, which pulls in the real model and Three.js, so this one pure
 * rule can be unit tested without touching either.
 */

export type CharacterAnimState = 'idle' | 'walk' | 'run' | 'jump';

/**
 * Which of the four clips fits a moment of movement, in order of how
 * unmistakable it is: airborne always shows the jump pose no matter how fast
 * you were moving on the way up, sprinting always reads as a run, and
 * anything slower than that is either a walk or standing still.
 */
export function pickAnimationState(
  moving: boolean,
  sprinting: boolean,
  airborne: boolean,
): CharacterAnimState {
  if (airborne) return 'jump';
  if (sprinting) return 'run';
  if (moving) return 'walk';
  return 'idle';
}
