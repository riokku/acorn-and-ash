import { describe, expect, it } from 'vitest';
import {
  createCollisionWorld,
  groundHeightAt,
  replaceCollider,
  resolveCapsule,
} from '../src/collision/capsule';
import { colliderTopAt, surfaceCollider } from '../src/collision/solid-surface';
import { PLAYER_HEIGHT, PLAYER_RADIUS, TICK_SECONDS } from '../src/constants';
import { colliderForProp, stumpColliderFor, type PlacedProp } from '../src/world/clearing';
import { createFlatTerrain, createWildernessTerrain } from '../src/world/terrain';
import { createInput, createPlayerMotion, PlayerButton, stepPlayer } from '../src/sim/player';
import { stonePositions } from '../src/world/stone-shape';
import { STREAM } from '../src/world/stream';
import {
  buildSpringRocks,
  buildSloughBoulders,
  buildWaterfallRocks,
  streamRockColliders,
} from '../src/world/scenery-rocks';

const terrain = createFlatTerrain(0);
const stump: PlacedProp = { id: 1, kind: 'stump', x: 0, y: 0, z: 0, scale: 2, rotationY: 0 };
const rock = surfaceCollider(0, 0, 0, stonePositions(1, 0.8, 4909));
const tick = (
  motion: ReturnType<typeof createPlayerMotion>,
  world: ReturnType<typeof createCollisionWorld>,
  moveX = 0,
  buttons = 0,
) => stepPlayer(motion, createInput(1, moveX, 0, 0, buttons), TICK_SECONDS, world);

describe('solid scenery and landing', () => {
  for (const [name, collider] of [
    ['river rock', rock],
    ['stump', colliderForProp(stump)],
  ] as const) {
    for (const indexed of [false, true]) {
      it(`${name} catches a fall, supports a stable stand and allows another jump (${indexed})`, () => {
        const world = createCollisionWorld(terrain, [collider], 100, null, indexed);
        const motion = createPlayerMotion({ x: 0, y: 4, z: 0 });
        motion.grounded = false;
        const roof = colliderTopAt(collider, 0, 0)!;
        for (let i = 0; i < 70; i++) tick(motion, world);
        expect(motion.position.x).toBe(0);
        expect(motion.position.z).toBe(0);
        expect(motion.position.y).toBeCloseTo(roof, 5);
        expect(motion.grounded).toBe(true);
        tick(motion, world, 0, PlayerButton.Jump);
        expect(motion.grounded).toBe(false);
        expect(motion.position.y).toBeGreaterThan(roof);
      });
    }
    it(`${name} blocks its sides from eight directions without jitter`, () => {
      const world = createCollisionWorld(terrain, [collider], 100, null, true);
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        const position = { x: Math.cos(angle) * 0.1, y: 0, z: Math.sin(angle) * 0.1 };
        expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(true);
        const again = { ...position };
        resolveCapsule(again, PLAYER_RADIUS, PLAYER_HEIGHT, world);
        expect(again.x).toBeCloseTo(position.x, 4);
        expect(again.z).toBeCloseTo(position.z, 4);
        expect(Math.hypot(position.x, position.z)).toBeGreaterThan(0.4);
      }
    });
    it(`${name} lets a player walk off the top and fall to terrain`, () => {
      const world = createCollisionWorld(terrain, [collider], 100);
      const motion = createPlayerMotion({ x: 0, y: colliderTopAt(collider, 0, 0)!, z: 0 });
      for (let i = 0; i < 70; i++) tick(motion, world, 1);
      expect(motion.position.x).toBeGreaterThan(2);
      expect(motion.position.y).toBe(0);
      expect(motion.grounded).toBe(true);
    });
  }
  it('actually jumps onto a stump from the ground instead of walking through its side', () => {
    const solid = colliderForProp({ ...stump, scale: 1 });
    const world = createCollisionWorld(terrain, [solid], 100);
    const walking = createPlayerMotion({ x: -0.9, y: 0, z: 0 });
    for (let i = 0; i < 20; i++) tick(walking, world, 1);
    expect(walking.position.y).toBe(0);
    expect(walking.position.x).toBeLessThan(-0.5);
    const jumping = createPlayerMotion({ x: -0.9, y: 0, z: 0 });
    tick(jumping, world, 1, PlayerButton.Jump);
    let stood = false;
    for (let i = 0; i < 30; i++) {
      tick(jumping, world, Math.max(-1, Math.min(1, -jumping.position.x * 2)));
      if (jumping.grounded && jumping.position.y > 0.4) {
        stood = true;
        break;
      }
    }
    expect(stood).toBe(true);
    expect(jumping.position.y).toBeCloseTo(
      colliderTopAt(solid, jumping.position.x, jumping.position.z)!,
      5,
    );
  });
  it('finds the curved roof instead of a floating flat cylinder top, without snapping from below', () => {
    const middle = colliderTopAt(rock, 0, 0)!,
      edge = colliderTopAt(rock, 0.6, 0)!;
    expect(edge).toBeLessThan(middle);
    const world = createCollisionWorld(terrain, [rock], 100);
    expect(groundHeightAt(world, 0, 0, 0)).toBe(0);
    expect(groundHeightAt(world, 0.6, 0, edge)).toBeCloseTo(edge, 6);
  });
  it('supports newly felled stumps through the existing tree replacement index', () => {
    const tree: PlacedProp = { ...stump, kind: 'pine', scale: 1 };
    const world = createCollisionWorld(terrain, [colliderForProp(tree)], 100, null, true);
    replaceCollider(world, 0, stumpColliderFor(tree));
    const roof = colliderTopAt(world.colliders[0]!, 0, 0)!;
    const motion = createPlayerMotion({ x: 0, y: 2, z: 0 });
    motion.grounded = false;
    for (let i = 0; i < 40; i++) tick(motion, world);
    expect(motion.position.y).toBeCloseTo(roof, 5);
    expect(motion.grounded).toBe(true);
  });
  it('catches a descending foot even when one tick crosses the entire roof', () => {
    const world = createCollisionWorld(terrain, [rock], 100);
    const motion = createPlayerMotion({ x: 0, y: 1.5, z: 0 });
    motion.grounded = false;
    motion.velocity.y = -15;
    stepPlayer(motion, createInput(1), 0.1, world);
    expect(motion.position.y).toBeCloseTo(colliderTopAt(rock, 0, 0)!, 5);
    expect(motion.grounded).toBe(true);
  });
  it('includes every spring, waterfall and slough boulder in the indexed collision world', () => {
    const ground = createWildernessTerrain(2026),
      colliders = streamRockColliders(STREAM, ground);
    const world = createCollisionWorld(ground, colliders, 500, null, true);
    for (const placement of [
      ...buildSpringRocks(STREAM, ground),
      ...buildSloughBoulders(STREAM, ground),
      ...buildWaterfallRocks(STREAM, ground),
    ]) {
      const collider = colliders.find((c) => c.x === placement.x && c.z === placement.z);
      expect(collider).toBeDefined();
      expect(collider!.standable).toBe(true);
      const roof = colliderTopAt(collider!, placement.x, placement.z)!;
      expect(groundHeightAt(world, placement.x, placement.z, roof)).toBeCloseTo(roof, 4);
    }
  });
});
