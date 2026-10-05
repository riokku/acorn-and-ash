import { describe, expect, it } from 'vitest';
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
    expect(steep.surfaceAt(10, 0)).toBe('forestFloor');
  });
});
