import { describe, expect, it } from 'vitest';

import {
  MIN_CLICK_DISTANCE,
  clickAimYaw,
  rayEntersCylinder,
  yawTowards,
  type ClickCandidate,
  type ClickRay,
} from '../src/input/click-target';

/** A ray from `origin` towards `through`, normalised. */
function rayThrough(
  origin: { x: number; y: number; z: number },
  through: { x: number; y: number; z: number },
): ClickRay {
  const dx = through.x - origin.x;
  const dy = through.y - origin.y;
  const dz = through.z - origin.z;
  const length = Math.hypot(dx, dy, dz);
  return { origin, direction: { x: dx / length, y: dy / length, z: dz / length } };
}

/** A camera up behind a player standing at the origin, the usual follow-camera spot. */
const CAMERA = { x: 0, y: 3, z: 6 };
const PLAYER = { x: 0, y: 0, z: 0 };

function tree(x: number, z: number): ClickCandidate[] {
  return [
    { x, z, radius: 0.35, bottom: 0, top: 2.5 },
    { x, z, radius: 1.4, bottom: 1.5, top: 7 },
  ];
}

describe('a ray and an upright cylinder', () => {
  const post: ClickCandidate = { x: 0, z: -5, radius: 0.5, bottom: 0, top: 2 };

  it('meets where it first touches the side', () => {
    const ray: ClickRay = { origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: -1 } };
    expect(rayEntersCylinder(ray, post)).toBeCloseTo(4.5, 6);
  });

  it('misses one off to the side', () => {
    const ray: ClickRay = { origin: { x: 2, y: 1, z: 0 }, direction: { x: 0, y: 0, z: -1 } };
    expect(rayEntersCylinder(ray, post)).toBeNull();
  });

  it('passes clean over the top of a short one', () => {
    const ray: ClickRay = { origin: { x: 0, y: 3, z: 0 }, direction: { x: 0, y: 0, z: -1 } };
    expect(rayEntersCylinder(ray, post)).toBeNull();
  });

  it('comes down through the top of one it is above', () => {
    const ray: ClickRay = { origin: { x: 0, y: 10, z: -5 }, direction: { x: 0, y: -1, z: 0 } };
    expect(rayEntersCylinder(ray, post)).toBeCloseTo(8, 6);
  });

  it('never counts one behind where the ray starts', () => {
    const ray: ClickRay = { origin: { x: 0, y: 1, z: 0 }, direction: { x: 0, y: 0, z: 1 } };
    expect(rayEntersCylinder(ray, post)).toBeNull();
  });
});

describe('which way a click turns the character', () => {
  it('faces a spot of ground ahead that was clicked', () => {
    const yaw = clickAimYaw(rayThrough(CAMERA, { x: 0, y: 0, z: -3 }), PLAYER, 0, []);
    // Yaw 0 looks down -Z.
    expect(yaw).toBeCloseTo(0, 6);
  });

  it('faces a spot of ground off to the right, without the camera having to turn', () => {
    const yaw = clickAimYaw(rayThrough(CAMERA, { x: 3, y: 0, z: 0 }), PLAYER, 0, []);
    expect(yaw).toBeCloseTo(-Math.PI / 2, 6);
  });

  it("faces a tree's trunk when its canopy was clicked, not the ground behind it", () => {
    // Up in the leaves, well above the trunk and off to its side.
    const ray = rayThrough(CAMERA, { x: -3.8, y: 4, z: -2 });
    const yaw = clickAimYaw(ray, PLAYER, 0, tree(-3, -3));
    expect(yaw).toBeCloseTo(yawTowards(PLAYER, { x: -3, z: -3 }) ?? Number.NaN, 6);
  });

  it('picks the nearer of two trees one behind the other', () => {
    const ray = rayThrough(CAMERA, { x: 0, y: 1, z: -2 });
    const near = tree(0, -2);
    const far = tree(0.3, -6);
    const yaw = clickAimYaw(ray, PLAYER, 0, [...far, ...near]);
    expect(yaw).toBeCloseTo(0, 6);
  });

  it('faces an animal that was clicked', () => {
    const rabbit: ClickCandidate = { x: 2, z: -2, radius: 0.55, bottom: 0, top: 0.9 };
    const yaw = clickAimYaw(rayThrough(CAMERA, { x: 2, y: 0.4, z: -2 }), PLAYER, 0, [rabbit]);
    expect(yaw).toBeCloseTo(-Math.PI / 4, 6);
  });

  it('ignores anything past the ground that was actually clicked', () => {
    // Clicking the ground a couple of metres ahead. A tree further on, down
    // a slope, reaches below this ground's height - the ray only meets it
    // once already underground, which is never what was clicked.
    const ray = rayThrough(CAMERA, { x: 0, y: 0, z: -2 });
    const downhill: ClickCandidate = { x: 0.8, z: -10, radius: 1, bottom: -10, top: 10 };
    const yaw = clickAimYaw(ray, PLAYER, 0, [downhill]);
    expect(yaw).toBeCloseTo(0, 6);
  });

  it('keeps its heading for a click into open sky', () => {
    const ray = rayThrough(CAMERA, { x: 0, y: 8, z: -10 });
    expect(clickAimYaw(ray, PLAYER, 0, [])).toBeNull();
  });

  it("keeps its heading for a click at the character's own feet", () => {
    const ray = rayThrough(CAMERA, { x: MIN_CLICK_DISTANCE / 2, y: 0, z: 0 });
    expect(clickAimYaw(ray, PLAYER, 0, [])).toBeNull();
  });
});
