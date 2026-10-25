import { describe, expect, it, vi } from 'vitest';
import {
  ForestAtmosphere,
  type ForestListener,
  type ForestSound,
} from '../src/audio/forest-atmosphere';
import { createForestEnvironment, type ForestEnvironment } from '../src/audio/forest-environment';
import { createFlatTerrain, SPAWN_POSITION } from '@acorn/shared';

const listener: ForestListener = {
  x: 0,
  z: 0,
  grounded: true,
  indoors: false,
  active: true,
  night: false,
  cameraYaw: 0,
};
const environment: ForestEnvironment = {
  surfaceAt: () => 'forestFloor',
  treesNear: () => [{ x: 4, z: 0 }],
  setStandingProps: () => {},
};
function setup() {
  const events: ForestSound[] = [];
  const atmosphere = new ForestAtmosphere(
    (event) => events.push(event),
    () => 0.5,
  );
  atmosphere.update(1 / 60, listener, environment);
  return { events, atmosphere };
}
function wait(atmosphere: ForestAtmosphere, at: ForestListener, seconds: number) {
  for (let frame = 0; frame < seconds * 60; frame++) atmosphere.update(1 / 60, at, environment);
}

describe('forest atmosphere', () => {
  it('steps follow distance actually travelled, even while attacking, but never a blocked movement intent', () => {
    const { events, atmosphere } = setup();
    wait(atmosphere, listener, 1);
    expect(events.filter((event) => event.kind === 'step')).toHaveLength(0);
    for (let frame = 1; frame <= 60; frame++)
      atmosphere.update(1 / 60, { ...listener, x: frame * 0.065 }, environment);
    const steps = events.filter((event) => event.kind === 'step');
    expect(steps).toHaveLength(2);
    expect(steps.every((step) => step.surface === 'forestFloor')).toBe(true);
    expect(steps[0]!.pan).toBe(-steps[1]!.pan);
  });

  it('silences airborne footsteps and plays one grounded landing; teleports do not step', () => {
    const { events, atmosphere } = setup();
    for (let frame = 1; frame <= 60; frame++)
      atmosphere.update(1 / 60, { ...listener, grounded: false, x: frame * 0.08 }, environment);
    expect(events.filter((event) => event.kind === 'step')).toHaveLength(0);
    atmosphere.update(1 / 60, { ...listener, x: 4.8 }, environment);
    expect(events.filter((event) => event.kind === 'step')).toHaveLength(1);
    atmosphere.update(1 / 60, { ...listener, x: 40 }, environment);
    expect(events.filter((event) => event.kind === 'step')).toHaveLength(1);
  });

  it('uses wood indoors without birds or canopy rustling', () => {
    const { events, atmosphere } = setup();
    const indoors = { ...listener, indoors: true };
    atmosphere.update(1 / 60, indoors, environment);
    wait(atmosphere, indoors, 40);
    expect(events).toEqual([]);
    for (let frame = 1; frame <= 60; frame++)
      atmosphere.update(1 / 60, { ...indoors, x: frame * 0.065 }, environment);
    expect(
      events.filter((event) => event.kind === 'step').every((event) => event.surface === 'wood'),
    ).toBe(true);
  });

  it('birds come from trees with camera-relative stereo and stop at night', () => {
    const { events, atmosphere } = setup();
    wait(atmosphere, listener, 12);
    const first = events.find((event) => event.kind === 'bird')!;
    expect(first.kind).toBe('bird');
    expect(first.pan).toBeGreaterThan(0);
    events.length = 0;
    wait(atmosphere, { ...listener, cameraYaw: Math.PI }, 24);
    expect(events.find((event) => event.kind === 'bird')!.pan).toBeLessThan(0);
    events.length = 0;
    wait(atmosphere, { ...listener, night: true }, 65);
    expect(events.some((event) => event.kind === 'bird')).toBe(false);
    expect(events.some((event) => event.kind === 'rustle')).toBe(true);
  });

  it('does not replay sounds on resume or long frames, or invent birds where no trees stand', () => {
    const { events, atmosphere } = setup();
    wait(atmosphere, { ...listener, active: false }, 40);
    atmosphere.update(1 / 60, listener, environment);
    atmosphere.update(0.25, listener, environment);
    expect(events).toEqual([]);
    const empty = { ...environment, treesNear: () => [] };
    for (let frame = 0; frame < 2400; frame++) atmosphere.update(1 / 60, listener, empty);
    expect(events).toEqual([]);
  });
});

describe('surface and living canopy lookup', () => {
  it('matches grass, worn arrival soil, forest litter and excludes stumps as bird perches', () => {
    const environment = createForestEnvironment(
      [
        { id: 1, kind: 'pine', x: 10, z: 0, rotationY: 0, scale: 1 },
        { id: 2, kind: 'stump', x: 0, z: 0, rotationY: 0, scale: 1 },
      ],
      [],
      createFlatTerrain(),
    );
    expect(environment.surfaceAt(0, 0)).toBe('grass');
    expect(environment.surfaceAt(SPAWN_POSITION.x, SPAWN_POSITION.z)).toBe('soil');
    expect(environment.surfaceAt(10.1, 0)).toBe('forestFloor');
    expect(environment.treesNear(0, 0)).toHaveLength(1);
    expect(environment.treesNear(100, 100)).toEqual([]);
  });

  it('keeps litter under a felled tree while removing its sound source', () => {
    const pine = { id: 1, kind: 'pine' as const, x: 10, z: 0, rotationY: 0, scale: 1 };
    const felled = createForestEnvironment([pine], [], createFlatTerrain(), []);
    expect(felled.surfaceAt(10.1, 0)).toBe('forestFloor');
    expect(felled.treesNear(10, 0)).toEqual([]);
    const regrown = createForestEnvironment([pine], [], createFlatTerrain(), [pine]);
    expect(regrown.treesNear(10, 0)).toHaveLength(1);
  });

  it('takes exposed hillside classification from actual elevation rather than assuming flat terrain', () => {
    const steep = createForestEnvironment([], [], { kind: 'slope', heightAt: (x) => x });
    expect(steep.surfaceAt(10, 0)).toBe('stone');
  });
});

describe('visible foot contact feedback', () => {
  it('retains the last phase across a brief inactive snapshot frame without losing a contact', () => {
    const { events, atmosphere } = setup();
    atmosphere.update(1 / 60, { ...listener, stridePhase: 0.49 }, environment);
    atmosphere.update(1 / 60, { ...listener, x: 0.02, stridePhase: null }, environment);
    atmosphere.update(1 / 60, { ...listener, x: 0.04, stridePhase: 0.51 }, environment);
    expect(events.filter((event) => event.kind === 'step')).toHaveLength(1);
  });

  it.each([30, 60, 144])(
    'follows contact phase instead of a separate distance clock at %s FPS',
    (fps) => {
      const { events, atmosphere } = setup();
      atmosphere.update(1 / fps, { ...listener, stridePhase: 0 }, environment);
      for (let frame = 1; frame <= fps * 2; frame++)
        atmosphere.update(
          1 / fps,
          { ...listener, x: (frame / fps) * 4.5, stridePhase: (frame / fps) % 1 },
          environment,
        );
      const steps = events.filter((event) => event.kind === 'step');
      expect(steps).toHaveLength(4);
      expect(steps.map((step) => step.pan)).toEqual([0.06, -0.06, 0.06, -0.06]);
    },
  );
  it('does not step while a full-body move or boat carries grounded feet, or replay a teleport', () => {
    const { events, atmosphere } = setup();
    for (let frame = 1; frame <= 60; frame++)
      atmosphere.update(1 / 60, { ...listener, x: frame * 0.05, stridePhase: null }, environment);
    expect(events.filter((event) => event.kind === 'step')).toHaveLength(0);
    atmosphere.update(1 / 60, { ...listener, x: 40, stridePhase: 0.8 }, environment);
    expect(events.filter((event) => event.kind === 'step')).toHaveLength(0);
    atmosphere.update(1 / 60, { ...listener, x: 40, stridePhase: 0.1 }, environment);
    expect(events.filter((event) => event.kind === 'step')).toHaveLength(0);
  });
  it('selects water, ice and snow at contact, while indoor floors retain wood', () => {
    const { events, atmosphere } = setup();
    const water = { ...environment, surfaceAt: () => 'water' as const };
    atmosphere.update(1 / 60, { ...listener, stridePhase: 0.4 }, water);
    atmosphere.update(1 / 60, { ...listener, x: 0.05, stridePhase: 0.6 }, water);
    atmosphere.update(1 / 60, { ...listener, x: 0.1, stridePhase: 0.1, frozenWater: true }, water);
    atmosphere.update(1 / 60, { ...listener, x: 0.15, stridePhase: 0.6, snow: true }, environment);
    atmosphere.update(
      1 / 60,
      { ...listener, x: 0.2, stridePhase: 0.1, indoors: true, snow: true },
      environment,
    );
    atmosphere.update(
      1 / 60,
      { ...listener, x: 0.25, stridePhase: 0.6, indoors: true, snow: true },
      environment,
    );
    expect(events.filter((event) => event.kind === 'step').map((step) => step.surface)).toEqual([
      'water',
      'ice',
      'snow',
      'wood',
    ]);
  });
  it('classifies a surface only when contact occurs, and keeps landing to one event', () => {
    const { events, atmosphere } = setup();
    const surfaceAt = vi.fn(() => 'grass' as const);
    const ground = { ...environment, surfaceAt };
    for (let frame = 0; frame < 60; frame++)
      atmosphere.update(1 / 60, { ...listener, stridePhase: null }, ground);
    expect(surfaceAt).not.toHaveBeenCalled();
    atmosphere.update(1 / 60, { ...listener, grounded: false, stridePhase: null }, ground);
    atmosphere.update(1 / 60, { ...listener, stridePhase: null }, ground);
    atmosphere.update(1 / 60, { ...listener, stridePhase: null }, ground);
    expect(surfaceAt).toHaveBeenCalledTimes(1);
    expect(events.filter((event) => event.kind === 'step')).toHaveLength(1);
    expect(atmosphere.scheduledSteps).toBe(1);
  });
  it('uses the actual water depth for wet ground classification', () => {
    const forest = createForestEnvironment([], [], createFlatTerrain());
    expect(forest.surfaceAt(100, -100)).toBe('water');
    expect(forest.surfaceAt(0, 0)).not.toBe('water');
    const pond = createForestEnvironment([], [{ x: 20, z: 20, radius: 2 }], createFlatTerrain());
    expect(pond.surfaceAt(20, 20)).toBe('water');
  });
});

it('matches dune sand and elevated rock/stump support instead of the ground beneath', () => {
  const props = [
    { id: 1, kind: 'boulder' as const, x: 20, z: 20, rotationY: 0, scale: 1 },
    { id: 2, kind: 'pine' as const, x: 30, z: 20, rotationY: 0, scale: 1 },
  ];
  const ground = createForestEnvironment(props, [], createFlatTerrain(), [props[0]!]);
  expect(ground.surfaceAt(-230, -234)).toBe('sand');
  expect(ground.surfaceAt(20, 20, 1)).toBe('stone');
  expect(ground.surfaceAt(30, 20, 0.4)).toBe('wood');
  ground.setStandingProps(props);
  expect(ground.surfaceAt(30, 20, 0.4)).not.toBe('wood');
});
it('scales landing feedback with uninterrupted airtime and clears it across pauses', () => {
  const events: ForestSound[] = [];
  const atmosphere = new ForestAtmosphere(
    (e) => events.push(e),
    () => 0.5,
  );
  atmosphere.update(1 / 60, listener, environment);
  const land = (frames: number) => {
    for (let i = 0; i < frames; i++)
      atmosphere.update(1 / 60, { ...listener, grounded: false }, environment);
    atmosphere.update(1 / 60, listener, environment);
    return events.filter((e) => e.kind === 'step').at(-1)!.volume;
  };
  const short = land(3),
    long = land(50);
  expect(short).toBeLessThan(long);
  expect(long).toBeLessThanOrEqual(0.95);
  atmosphere.update(1, { ...listener, active: false }, environment);
  atmosphere.update(1 / 60, listener, environment);
  expect(land(3)).toBeCloseTo(short);
});

it('leaves more quiet space for birds in heavy precipitation', () => {
  const count = (rain: number) => {
    const events: ForestSound[] = [];
    const atmosphere = new ForestAtmosphere(
      (e) => events.push(e),
      () => 0.5,
    );
    for (let i = 0; i < 120 * 60; i++)
      atmosphere.update(1 / 60, { ...listener, precipitation: rain }, environment);
    return events.filter((e) => e.kind === 'bird');
  };
  const dry = count(0),
    wet = count(1);
  expect(wet.length).toBeLessThan(dry.length);
  expect(wet[0]!.volume).toBeLessThan(dry[0]!.volume);
});
