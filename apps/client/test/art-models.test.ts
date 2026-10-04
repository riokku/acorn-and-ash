import { createExpeditionBoard } from '../src/scene/expedition-board';
import { createHomeDecoration } from '../src/scene/home-decoration';
import { createDiscoveryLandmarks } from '../src/scene/discovery-sites';
import { createHomeFacilities } from '../src/scene/home-facilities';
import { createForageModel, createMealModel } from '../src/scene/forest-food';
import { DISCOVERIES } from '@acorn/shared';
import { createEncounterLandmarks } from '../src/scene/encounter-sites';
import {
  ANIMAL_KINDS,
  BUILDABLE_KINDS,
  PROP_KINDS,
  SPAWN_POSITION,
  createFlatTerrain,
} from '@acorn/shared';
import * as THREE from 'three/webgpu';
import { describe, expect, it } from 'vitest';

import { createGroundShader } from '../src/art/ground-shading';
import { triangleCount } from '../src/art/shapes';
import { createBuriedCacheMound } from '../src/scene/buried-cache';
import { createShelter } from '../src/scene/shelter';
import { createLargeCabin } from '../src/scene/large-cabin';
import { createCabin } from '../src/scene/cabin';
import { createCritter } from '../src/scene/critter';
import { createFence } from '../src/scene/fence';
import { createFlowerBed } from '../src/scene/flower-bed';
import { createGardenPath } from '../src/scene/garden-path';
import { createLantern } from '../src/scene/lantern';
import { createSatchel, createStickPileModel, stumpGeometries } from '../src/scene/pickup-models';
import { createRaccoon } from '../src/scene/raccoon';

/** CLAUDE.md's own ceiling for a small prop. */
const PROP_BUDGET = 2000;

/** How far a model reaches from its middle, looking straight down. */
function reach(group: THREE.Object3D): number {
  let furthest = 0;
  const point = new THREE.Vector3();
  group.updateMatrixWorld(true);
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    const position = (child.geometry as THREE.BufferGeometry).attributes.position;
    if (position === undefined) return;
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld);
      furthest = Math.max(furthest, Math.hypot(point.x, point.z));
    }
  });
  return furthest;
}

describe("the game's own models", () => {
  const budgets = [
    { name: 'expedition board', make: createExpeditionBoard, budget: 800 },
    {
      name: 'trail pennant',
      make: () => createHomeDecoration('trailPennant'),
      budget: BUILDABLE_KINDS.trailPennant.triangleBudget,
    },
    ...(['teepee', 'cabin', 'largeCabin'] as const).map((kind) => ({
      name: `${kind} facilities`,
      budget: kind === 'largeCabin' ? PROP_BUDGET * 3 : PROP_BUDGET,
      make: () => createHomeFacilities(kind),
    })),
    ...DISCOVERIES.filter(
      (definition) => definition.id < 4 || definition.kind === 'raccoonHollow',
    ).map((definition) => ({
      name: `${definition.kind} discovery`,
      budget: PROP_BUDGET,
      make: () => createDiscoveryLandmarks([{ ...definition, x: 0, z: 0 }], createFlatTerrain()),
    })),
    ...(['berry', 'mushroom'] as const).map((item) => ({
      name: `${item} forage`,
      budget: PROP_BUDGET,
      make: () => createForageModel(item),
    })),
    ...(['trailRation', 'forestStew', 'berryTea'] as const).map((item) => ({
      name: `${item} meal`,
      budget: PROP_BUDGET,
      make: () => createMealModel(item),
    })),
    ...(['ruins', 'patrol', 'wanderer'] as const).map((kind) => ({
      name: `${kind} landmark`,
      budget: PROP_BUDGET,
      make: () =>
        createEncounterLandmarks([{ id: 1, kind, x: 0, z: 0, yaw: 0 }], createFlatTerrain()),
    })),
    {
      name: 'tent',
      make: () => createShelter('tent'),
      budget: BUILDABLE_KINDS.tent.triangleBudget,
    },
    {
      name: 'teepee',
      make: () => createShelter('teepee'),
      budget: BUILDABLE_KINDS.teepee.triangleBudget,
    },
    {
      name: 'large cabin',
      make: createLargeCabin,
      budget: BUILDABLE_KINDS.largeCabin.triangleBudget,
    },
    { name: 'cabin', make: createCabin, budget: BUILDABLE_KINDS.cabin.triangleBudget },
    { name: 'fence', make: createFence, budget: BUILDABLE_KINDS.fence.triangleBudget },
    { name: 'flower bed', make: createFlowerBed, budget: BUILDABLE_KINDS.flowerBed.triangleBudget },
    { name: 'lantern', make: createLantern, budget: BUILDABLE_KINDS.lantern.triangleBudget },
    {
      name: 'garden path',
      make: createGardenPath,
      budget: BUILDABLE_KINDS.gardenPath.triangleBudget,
    },
    { name: 'rabbit', make: createCritter, budget: ANIMAL_KINDS.rabbit.triangleBudget },
    { name: 'raccoon', make: createRaccoon, budget: ANIMAL_KINDS.maskedRaccoon.triangleBudget },
    { name: 'buried mound', make: createBuriedCacheMound, budget: PROP_BUDGET },
    { name: 'sack', make: createSatchel, budget: PROP_BUDGET },
    { name: 'stick pile', make: createStickPileModel, budget: PROP_BUDGET },
  ];

  for (const { name, make, budget } of budgets) {
    it(`keeps the ${name} within its ${budget}-triangle budget`, () => {
      const model = make();
      const triangles = triangleCount(model.group);
      expect(triangles).toBeGreaterThan(0);
      expect(triangles).toBeLessThanOrEqual(budget);
      model.dispose();
    });
  }

  it('keeps the stump within its budget', () => {
    const { bark, top } = stumpGeometries(
      PROP_KINDS.stump.shape.radius,
      PROP_KINDS.stump.shape.height,
    );
    const triangles = ((bark.index?.count ?? 0) + (top.index?.count ?? 0)) / 3;
    expect(triangles).toBeLessThanOrEqual(PROP_KINDS.stump.triangleBudget);
  });

  it('keeps the cabin inside the room its footprint asks for', () => {
    // The walls stay within the footprint; only the roof's overhang, well
    // above anybody's head, may reach a little past it.
    const cabin = createCabin();
    expect(reach(cabin.group)).toBeLessThan(BUILDABLE_KINDS.cabin.footprintRadius + 0.5);
    cabin.dispose();
  });

  it("puts a fence piece's posts right on its two ends, where the next piece joins", () => {
    const fence = createFence();
    const box = new THREE.Box3().setFromObject(fence.group);
    // 1.4 m post to post, the length the build rules treat a fence piece as.
    const halfLength = 0.7;
    // The posts stand at either end; the rails poke only a little past them.
    expect(box.max.x).toBeGreaterThan(halfLength);
    expect(box.max.x).toBeLessThan(halfLength + 0.12);
    expect(box.min.x).toBeLessThan(-halfLength);
    expect(Math.abs(box.max.z)).toBeLessThan(0.15);
    fence.dispose();
  });

  it('faces its creatures towards -Z, the way yaw 0 walks', () => {
    for (const make of [createCritter, createRaccoon]) {
      const creature = make();
      // The very top of each - the rabbit's ears, the raccoon's ears - is on
      // its head, which is at the front.
      let highest = { y: Number.NEGATIVE_INFINITY, z: 0 };
      creature.group.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        const position = (child.geometry as THREE.BufferGeometry).attributes.position;
        if (position === undefined) return;
        for (let i = 0; i < position.count; i++) {
          if (position.getY(i) > highest.y) highest = { y: position.getY(i), z: position.getZ(i) };
        }
      });
      expect(highest.z).toBeLessThan(0);
      creature.dispose();
    }
  });
});

describe('how the ground looks', () => {
  const shader = createGroundShader({
    water: [{ x: 10, z: 10, radius: 3 }],
    props: [{ id: 1, kind: 'oak', x: -10, z: -10, rotationY: 0, scale: 1 }],
  });

  it('is lawn in the open clearing', () => {
    expect(shader.shadeAt(8, -6, 0).floor).toBeLessThan(0.2);
  });

  it('is worn bare where everybody arrives', () => {
    expect(shader.shadeAt(SPAWN_POSITION.x, SPAWN_POSITION.z, 0).floor).toBeGreaterThan(0.4);
  });

  it('gathers leaf litter under a tree, and is shadier there', () => {
    const under = shader.shadeAt(-10, -10.5, 0);
    const open = shader.shadeAt(8, -6, 0);
    expect(under.floor).toBeGreaterThan(open.floor + 0.3);
    expect(under.tint[1]).toBeLessThan(open.tint[1]);
  });

  it('stays grassy right by the water', () => {
    expect(shader.shadeAt(10, 13.5, 0).floor).toBeLessThan(0.2);
  });

  it('loses its grass on a steep slope', () => {
    expect(shader.shadeAt(8, -6, 1.2).floor).toBeGreaterThan(0.8);
  });

  it('comes out the same every time', () => {
    expect(shader.shadeAt(3.3, 7.7, 0.1)).toEqual(shader.shadeAt(3.3, 7.7, 0.1));
  });
});
