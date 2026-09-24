import { describe, expect, it } from 'vitest';

import { FollowCamera } from '../src/camera/follow-camera';

const PLAYER_POSITION = { x: 0, y: 0, z: 0 };

describe('camera shake', () => {
  it('clamps to full strength no matter how many hits land at once', () => {
    const followCamera = new FollowCamera(16 / 9);
    followCamera.update(PLAYER_POSITION, 0, []);
    const rest = followCamera.camera.position.clone();

    followCamera.shake(1);
    followCamera.shake(1);
    followCamera.shake(1);
    followCamera.update(PLAYER_POSITION, 0, []);
    const shaken = followCamera.camera.position.clone();

    expect(shaken.distanceTo(rest)).toBeGreaterThan(0);
    // Full strength only nudges the camera a few centimetres - stacking three
    // hits at once should not move it any further than one already would.
    expect(shaken.distanceTo(rest)).toBeLessThan(0.3);
  });

  it('settles back to the exact resting position once it decays away', () => {
    const followCamera = new FollowCamera(16 / 9);
    followCamera.update(PLAYER_POSITION, 0, []);
    const rest = followCamera.camera.position.clone();

    followCamera.shake(1);
    followCamera.update(PLAYER_POSITION, 2, []); // Absorbs and fully decays the shake.
    followCamera.update(PLAYER_POSITION, 0, []); // One more frame with nothing left to apply.

    expect(followCamera.camera.position.equals(rest)).toBe(true);
  });
});
