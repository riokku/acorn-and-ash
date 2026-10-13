import { expect, it } from 'vitest';
import { FollowCamera } from '../src/camera/follow-camera';
const PLAYER_POSITION = { x: 0, y: 0, z: 0 };

it('suppresses and clears impact shake for reduced motion while retaining manual orbit', () => {
  const follow = new FollowCamera(16 / 9);
  follow.update(PLAYER_POSITION, 0, []);
  const resting = follow.camera.position.clone();
  follow.shake(1);
  follow.setReducedMotion(true);
  follow.shake(1);
  follow.update(PLAYER_POSITION, 0, []);
  expect(follow.camera.position.equals(resting)).toBe(true);
  follow.turn(20, 0, 0.01);
  follow.update(PLAYER_POSITION, 0, []);
  expect(follow.camera.position.equals(resting)).toBe(false);
});
