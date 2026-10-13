import {
  ActionKind,
  type ActionState,
  createActionState,
  dodgeHeading,
  stepDodge,
  stepDodgeAttack,
  DODGE_SPEED,
} from '../src/sim/actions';
import { surfaceCollider, colliderTopAt } from '../src/collision/solid-surface';
import { createPlayerMotion, stepPlayer } from '../src/sim/player';
import { createInput } from '../src/sim/player';
import { afterEach, describe, expect, it } from 'vitest';
import { BUILDABLE_KIND_ORDER } from '../src/data/buildables';
import { isHomeKind } from '../src/data/housing';
import { placedPropColliders } from '../src/world/placed-solids';
import { createFlatTerrain } from '../src/world/terrain';
import { createCollisionWorld, resolveCapsule } from '../src/collision/capsule';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../src/constants';
import { WorldSimulation } from '../src/sim/world-sim';
import { navigableWaterSurfaceAt } from '../src/world/navigable-water';
const sims: WorldSimulation[] = [];
afterEach(() => {
  for (const sim of sims.splice(0)) sim.dispose();
});
const flat = createFlatTerrain();
const prop = (kind: 'fence' | 'rowboat' | 'lantern' = 'fence', x = 0, z = 0) => ({
  id: 50,
  kind,
  x,
  z,
  yaw: 0,
  lit: false,
});

describe('solid placed props', () => {
  for (const kind of BUILDABLE_KIND_ORDER) {
    if (isHomeKind(kind) || kind === 'gardenPath' || kind === 'wovenRug') continue;
    it(`${kind} has solid parts that stop a walking body`, () => {
      const p = { kind, x: 0, z: 0, yaw: 0.4 };
      const solids = placedPropColliders(p, 0);
      expect(solids.length).toBeGreaterThan(0);
      const y = kind === 'rowboat' ? navigableWaterSurfaceAt(0, 0) - 0.2 : 0;
      const position = { x: 0, y, z: 0 };
      const world = createCollisionWorld(flat, solids, 100);
      expect(resolveCapsule(position, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(true);
      expect(Math.hypot(position.x, position.z)).toBeGreaterThan(0.3);
    });
  }
  it('walks uphill over a gentle solid facet instead of being shoved down its side', () => {
    const top = (x: number) => 0.9 + 0.7 * x;
    const roof = [
      -1,
      top(-1),
      -1,
      1,
      top(1),
      1,
      1,
      top(1),
      -1,
      -1,
      top(-1),
      -1,
      -1,
      top(-1),
      1,
      1,
      top(1),
      1,
    ];
    const solid = surfaceCollider(0, 0, 0, roof);
    const world = createCollisionWorld(flat, [solid], 100);
    const motion = createPlayerMotion({ x: -0.2, y: top(-0.2), z: 0 });
    for (let i = 0; i < 4; i++) {
      const previous = motion.position.x;
      stepPlayer(motion, createInput(i + 1, 1, 0, 0), 0.05, world);
      expect(motion.position.x).toBeGreaterThan(previous);
      expect(motion.position.y).toBeCloseTo(colliderTopAt(solid, motion.position.x, 0)!, 5);
      expect(motion.grounded).toBe(true);
    }
  });
  it('keeps a dodge and its attack hop over the same rising solid surface', () => {
    const top = (x: number) => 0.9 + 0.7 * x;
    const solid = surfaceCollider(0, 0, 0, [
      -1,
      top(-1),
      -1,
      1,
      top(1),
      1,
      1,
      top(1),
      -1,
      -1,
      top(-1),
      -1,
      -1,
      top(-1),
      1,
      1,
      top(1),
      1,
    ]);
    const world = createCollisionWorld(flat, [solid], 100);
    const motion = createPlayerMotion({ x: -0.2, y: top(-0.2), z: 0 });
    const state: ActionState = {
      ...createActionState(),
      kind: ActionKind.Dodge,
      heading: dodgeHeading(createInput(1, 1, 0, 0)),
    };
    stepDodge(motion, state, world);
    expect(motion.position.x).toBeGreaterThan(-0.2);
    expect(motion.position.y).toBeCloseTo(top(motion.position.x), 5);
    const hop = createPlayerMotion({ x: -0.2, y: top(-0.2), z: 0 });
    hop.velocity.x = DODGE_SPEED;
    state.kind = ActionKind.DodgeLight;
    state.age = 1;
    stepDodgeAttack(hop, state, world);
    expect(hop.position.x).toBeGreaterThan(-0.2);
    expect(hop.position.y).toBeGreaterThan(top(hop.position.x));
  });
  it('keeps rugs and inset path surfaces walkable', () => {
    expect(placedPropColliders({ kind: 'gardenPath', x: 0, z: 0, yaw: 0 }, 0)).toEqual([]);
    expect(placedPropColliders({ kind: 'wovenRug', x: 0, z: 0, yaw: 0 }, 0)).toEqual([]);
  });
  it('allows a jump over a fence and respects its rotation and planted height', () => {
    const p = { ...prop(), yaw: Math.PI / 2 };
    const solids = placedPropColliders(p, 4);
    const world = createCollisionWorld(createFlatTerrain(4), solids, 100);
    const at = { x: 0.1, y: 4, z: 0 };
    expect(resolveCapsule(at, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(true);
    expect(Math.abs(at.x)).toBeGreaterThan(0.4);
    const above = { x: 0, y: 5, z: 0 };
    expect(resolveCapsule(above, PLAYER_RADIUS, PLAYER_HEIGHT, world)).toBe(false);
  });
  it('removes the placed hull body when a rower takes ownership', () => {
    expect(placedPropColliders({ ...prop('rowboat'), occupied: true }, 0)).toEqual([]);
    expect(placedPropColliders({ ...prop('rowboat'), rower: 1 }, 0)).toEqual([]);
  });
  it('restores static props as solids and removes expired solids without shifting forest slots', () => {
    const sim = new WorldSimulation({ seed: 2026 });
    sims.push(sim);
    const count = sim.collision.colliders.length;
    const first = sim.collision.colliders[0];
    sim.restoreBuiltProps([
      { ...prop(), x: 0, z: -3, ownerKey: 'owner', litUntilMs: null, expiresAtMs: 100 },
    ]);
    expect(sim.collision.colliders.length).toBe(count + 1);
    const at = { x: 0, y: sim.collision.terrain.heightAt(0, -3), z: -3 };
    expect(resolveCapsule(at, PLAYER_RADIUS, PLAYER_HEIGHT, sim.collision)).toBe(true);
    expect(sim.removeExpiredBuilds(101)).toEqual([50]);
    expect(sim.collision.colliders.length).toBe(count);
    expect(sim.collision.colliders[0]).toBe(first);
  });
  it('registers a newly built fence immediately', () => {
    const sim = new WorldSimulation({ seed: 2026 });
    sims.push(sim);
    sim.restoreBuiltProps([
      {
        id: 60000,
        kind: 'cabin',
        x: 0,
        z: 15,
        yaw: 0,
        lit: false,
        ownerKey: 'builder',
        litUntilMs: null,
      },
    ]);
    sim.addPlayer(
      1,
      {
        netId: 1,
        x: 0,
        y: 0,
        z: 0,
        facingYaw: 0,
        hunger: 100,
        items: [
          { item: 'log', count: 20 },
          { item: 'stick', count: 20 },
        ],
      },
      'builder',
    );
    sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
    const before = sim.collision.colliders.length;
    sim.requestBuild(1, { kind: 'fence', x: 0, z: -3, yaw: 0 });
    sim.queueInput(1, createInput(1));
    sim.step(1000);
    expect(sim.drainBuildReplies()).toEqual([
      { netId: 1, request: { kind: 'fence', x: 0, z: -3, yaw: 0 }, reason: null },
    ]);
    expect(sim.collision.colliders.length).toBe(before + 1);
    const at = { x: 0, y: 0, z: -3 };
    expect(resolveCapsule(at, PLAYER_RADIUS, PLAYER_HEIGHT, sim.collision)).toBe(true);
  });
});
