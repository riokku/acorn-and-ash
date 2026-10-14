import { describe, expect, it } from 'vitest';
import * as THREE from 'three/webgpu';
import { PLAYER_HEIGHT } from '@acorn/shared';
import { installBvhRaycasting } from '../src/scene/bvh';

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

// Real triangles are important here: camera collision must respect the
// rendered slope and openings, rather than an unrelated height-map clamp.

function slopeGround(slope: number) {
  installBvhRaycasting();
  const geometry = new THREE.PlaneGeometry(30, 30, 12, 12);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) positions.setY(i, slope * positions.getZ(i));
  geometry.computeVertexNormals();
  geometry.computeBoundsTree({ indirect: true });
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.updateMatrixWorld();
  return mesh;
}

describe('terrain camera clearance', () => {
  it('keeps the camera and every near-plane corner above steep ground through fast turns and shake', () => {
    const ground = slopeGround(2.2);
    const follow = new FollowCamera(21 / 9);
    for (let turn = 0; turn < 24; turn++) {
      follow.look.yaw = (turn * Math.PI) / 12;
      follow.look.pitch = turn % 2 === 0 ? -0.55 : 0.32;
      follow.shake(1);
      follow.update(PLAYER_POSITION, 1 / 60, [], ground);
      const camera = follow.camera;
      camera.updateMatrixWorld();
      expect(camera.position.y - 2.2 * camera.position.z).toBeGreaterThan(0.05);
      const halfHeight = camera.near * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      for (const x of [-1, 1])
        for (const y of [-1, 1]) {
          const corner = new THREE.Vector3(
            x * halfHeight * camera.aspect,
            y * halfHeight,
            -camera.near,
          ).applyMatrix4(camera.matrixWorld);
          expect(corner.y - 2.2 * corner.z).toBeGreaterThan(0);
        }
    }
    ground.geometry.disposeBoundsTree();
    ground.geometry.dispose();
  });

  it('pulls in immediately for the ground and eases out when the view clears', () => {
    const follow = new FollowCamera(16 / 9),
      ground = slopeGround(0);
    follow.look.pitch = -0.55;
    follow.update(PLAYER_POSITION, 0, [], ground);
    const pulledIn = follow.camera.position.distanceTo(
      new THREE.Vector3(0, PLAYER_HEIGHT * 0.78, 0),
    );
    expect(follow.camera.position.y).toBeGreaterThan(0.1);
    follow.look.pitch = 0.32;
    follow.update(PLAYER_POSITION, 1 / 60, [], ground);
    const target = new THREE.Vector3(0, PLAYER_HEIGHT * 0.78, 0);
    const easing = follow.camera.position.distanceTo(target);
    expect(easing).toBeCloseTo(pulledIn);
    follow.update(PLAYER_POSITION, 0.15, [], ground);
    expect(follow.camera.position.distanceTo(target)).toBeGreaterThan(pulledIn);
    expect(easing).toBeLessThan(6);
    follow.update(PLAYER_POSITION, 2, [], ground);
    expect(follow.camera.position.distanceTo(target)).toBeCloseTo(6);
    ground.geometry.disposeBoundsTree();
    ground.geometry.dispose();
  });

  it('ignores removed ground triangles and leaves indoor framing unchanged', () => {
    const ground = slopeGround(0),
      follow = new FollowCamera(16 / 9);
    const indices = ground.geometry.getIndex()!;
    for (let i = 0; i < indices.count; i++) indices.setX(i, 0);
    follow.look.pitch = -0.55;
    follow.update(PLAYER_POSITION, 0, [], ground);
    expect(follow.camera.position.y).toBeLessThan(0);
    follow.setIndoors(true);
    follow.update(PLAYER_POSITION, 0, [], ground);
    const indoors = follow.camera.position.clone();
    follow.update(PLAYER_POSITION, 0, []);
    expect(follow.camera.position.equals(indoors)).toBe(true);
    ground.geometry.disposeBoundsTree();
    ground.geometry.dispose();
  });
});

function boxBlocker(x: number, z: number, width = 0.1) {
  installBvhRaycasting();
  const geometry = new THREE.BoxGeometry(width, 5, 0.2);
  geometry.computeBoundsTree();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
  mesh.position.set(x, 1, z);
  mesh.updateMatrixWorld();
  return mesh;
}

function disposeBlocker(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>) {
  mesh.geometry.disposeBoundsTree();
  mesh.geometry.dispose();
  mesh.material.dispose();
}

describe('scenery camera clearance', () => {
  it.each([16 / 9, 21 / 9])('protects a grazing view edge at aspect %s', (aspect) => {
    const follow = new FollowCamera(aspect);
    follow.look.pitch = 0;
    const blocker = boxBlocker(0.13, 3);
    const target = new THREE.Vector3(0, PLAYER_HEIGHT * 0.78, 0);
    // The centre ray misses this obstacle: the edge of the view must catch it.
    expect(
      new THREE.Raycaster(target, new THREE.Vector3(0, 0, 1)).intersectObject(blocker),
    ).toEqual([]);
    follow.update(PLAYER_POSITION, 1 / 60, [blocker]);
    expect(follow.camera.position.z).toBeLessThan(2.7);
    expect(follow.camera.position.z).toBeGreaterThan(0);
    disposeBlocker(blocker);
  });

  it('keeps clearance from a nearby obstacle instead of enforcing a distance beyond it', () => {
    const follow = new FollowCamera(16 / 9),
      blocker = boxBlocker(0, 0.75, 2);
    follow.look.pitch = 0;
    follow.update(PLAYER_POSITION, 0, [blocker]);
    expect(follow.camera.position.z).toBeCloseTo(0.35);
    follow.update(PLAYER_POSITION, 1 / 60, []);
    expect(follow.camera.position.z).toBeCloseTo(0.35);
    follow.update(PLAYER_POSITION, 0.15, []);
    expect(follow.camera.position.z).toBeGreaterThan(0.35);
    expect(follow.camera.position.z).toBeLessThan(6);
    disposeBlocker(blocker);
  });

  it('holds clearance through repeated turns and impact shake without ground', () => {
    const follow = new FollowCamera(21 / 9),
      blocker = boxBlocker(0, 3, 8);
    for (const yaw of [-0.3, 0, 0.3]) {
      follow.look.yaw = yaw;
      follow.look.pitch = 0;
      for (let frame = 0; frame < 10; frame++) {
        follow.shake(1);
        follow.update(PLAYER_POSITION, 1 / 60, [blocker]);
        expect(follow.camera.position.z).toBeLessThan(2.9);
      }
    }
    disposeBlocker(blocker);
  });
});

describe('camera easing across frame rates', () => {
  it('returns from an obstruction consistently at 30, 60 and 144 FPS and through a slow frame', () => {
    const released = (steps: number[]) => {
      const follow = new FollowCamera(16 / 9),
        blocker = boxBlocker(0, 3, 8);
      follow.look.pitch = 0;
      follow.update(PLAYER_POSITION, 0, [blocker]);
      for (const delta of steps) follow.update(PLAYER_POSITION, delta, []);
      disposeBlocker(blocker);
      return follow.camera.position.z;
    };
    const baseline = released(Array(30).fill(1 / 60));
    for (const fps of [30, 60, 144])
      expect(released(Array(fps / 2).fill(1 / fps))).toBeCloseTo(baseline, 10);
    expect(released([0.2, 0.1, 0.2])).toBeCloseTo(baseline, 10);
    expect(baseline).toBeGreaterThan(5.6);
    expect(baseline).toBeLessThan(6);
  });

  it('nudges fishing pitch consistently without snapping on a long frame', () => {
    const nudged = (steps: number[]) => {
      const follow = new FollowCamera(16 / 9);
      follow.lookDownTo(0.9);
      for (const delta of steps) follow.update(PLAYER_POSITION, delta, []);
      return follow.look.pitch;
    };
    const baseline = nudged(Array(30).fill(1 / 60));
    for (const fps of [30, 60, 144])
      expect(nudged(Array(fps / 2).fill(1 / fps))).toBeCloseTo(baseline, 10);
    expect(nudged([0.25, 0.25])).toBeCloseTo(baseline, 10);
    expect(baseline).toBeLessThan(0.9);
    const follow = new FollowCamera(16 / 9);
    follow.lookDownTo(0.9);
    follow.turn(0, -10, 0.01);
    const requested = follow.look.pitch;
    follow.update(PLAYER_POSITION, 1, []);
    expect(follow.look.pitch).toBe(requested);
  });
});

describe('short gaps between camera blockers', () => {
  it('does not pump outward through two-frame gaps while passing a row of trunks', () => {
    const follow = new FollowCamera(16 / 9),
      blocker = boxBlocker(0, 3, 8);
    follow.look.pitch = 0;
    follow.update(PLAYER_POSITION, 0, [blocker]);
    const held = follow.camera.position.z;
    for (let frame = 0; frame < 60; frame++) {
      follow.update(PLAYER_POSITION, 1 / 60, frame % 4 < 2 ? [] : [blocker]);
      expect(follow.camera.position.z).toBeCloseTo(held, 6);
    }
    follow.update(PLAYER_POSITION, 0.5, []);
    expect(follow.camera.position.z).toBeGreaterThan(5.5);
    disposeBlocker(blocker);
  });
});

it('makes cursor rays follow an immediate camera turn before any renderer update', () => {
  const follow = new FollowCamera(16 / 9);
  follow.update(PLAYER_POSITION, 0, []);
  follow.turn(85, 20, 0.01);
  follow.update(PLAYER_POSITION, 0, []);
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(0, 0), follow.camera);
  const target = new THREE.Vector3(0, PLAYER_HEIGHT * 0.78, 0);
  const expected = target.sub(follow.camera.position).normalize();
  expect(ray.ray.direction.distanceTo(expected)).toBeLessThan(1e-8);
});
