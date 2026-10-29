import { afterEach, expect, it, vi } from 'vitest';
import * as THREE from 'three/webgpu';
import { ActionKind, type RaiderKindId } from '@acorn/shared';
import { RaiderFigure } from '../src/scene/raider-figure';
import type { Character } from '../src/scene/character';
import type { ImpactBursts } from '../src/scene/impact-bursts';
import { movePose, type MoveView } from '../src/scene/character-moves';

const audio = vi.hoisted(() => ({ ring: vi.fn(), clank: vi.fn(), bone: vi.fn() }));
vi.mock('../src/audio/raid-sounds', () => ({
  playWindupRing: audio.ring,
  playClank: audio.clank,
  playBoneClatter: audio.bone,
  playEarthRumble: vi.fn(),
}));
vi.mock('../src/scene/raider-health-bar', () => ({
  RaiderHealthBar: class {
    sprite = new THREE.Sprite();
    update() {}
    dispose() {}
    setHealth() {}
    setWanted() {}
  },
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

function setup(kind: RaiderKindId = 'minion') {
  // Only the canvas artwork is omitted. Exercise the figure's real timing,
  // warning, recoil and hit-stop contract; the loaded rig is checked in Chrome.
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => null }) });
  const parent = new THREE.Group();
  const hitStop = vi.fn(),
    burst = vi.fn();
  const character = {
    group: new THREE.Group(),
    update: (_dt: number, frame: { move: MoveView }) => movePose(frame.move),
    heldTip: (v: THREE.Vector3) => v.set(0, 1, -0.5),
    handPosition: (v: THREE.Vector3) => v.set(0, 0.8, 0),
    hitStop,
    dispose: vi.fn(),
  } as unknown as Character;
  const figure = RaiderFigure.create(
    kind,
    parent,
    { burst } as unknown as ImpactBursts,
    character,
  )!;
  const draw = (kind: ActionKind, age: number) =>
    figure.draw(
      1 / 60,
      { x: 0, y: 0, z: 0, yaw: 0 },
      {
        move: { kind, age, step: 0, atTree: false, flinchVariant: 0, roll: 'forward' },
        locomotion: { speed: 0, airborne: false },
      },
      0,
    );
  return { parent, figure, hitStop, burst, draw };
}

it('reports the last drawn action and warning without exposing mutable state', () => {
  const { figure, draw } = setup();
  try {
    expect(figure.display()).toBeNull();
    draw(ActionKind.Windup, 3.5);
    const shown = figure.display()!;
    expect(shown).toMatchObject({
      kind: ActionKind.Windup,
      step: 0,
      age: 3.5,
      warning: { visible: true },
    });
    expect(shown.warning.opacity).toBeGreaterThan(0);
    shown.age = 99;
    shown.warning.visible = false;
    expect(figure.display()).toEqual({
      ...shown,
      age: 3.5,
      warning: { ...shown.warning, visible: true },
    });
    draw(ActionKind.Idle, 0);
    expect(figure.display()).toMatchObject({
      kind: ActionKind.Idle,
      age: 0,
      warning: { visible: false },
    });
  } finally {
    figure.dispose();
  }
});

it('keeps wind-up audio stable across fractional snapshot corrections but plays a fresh attack', () => {
  const { figure, draw, parent } = setup();
  try {
    draw(ActionKind.Windup, 3);
    draw(ActionKind.Windup, 2.8);
    draw(ActionKind.Windup, 3.2);
    draw(ActionKind.Windup, 3);
    expect(audio.ring).toHaveBeenCalledTimes(1);
    draw(ActionKind.Windup, 0);
    expect(audio.ring).toHaveBeenCalledTimes(2);
    draw(ActionKind.Charge, 4);
    draw(ActionKind.Charge, 3.8);
    expect(audio.ring).toHaveBeenCalledTimes(3);
    expect(audio.ring).toHaveBeenLastCalledWith(0, true);
    draw(ActionKind.Flinch, 0);
    expect(parent.getObjectByName('raider-attack-warning')!.visible).toBe(false);
  } finally {
    figure.dispose();
  }
});

it('keeps an armored contact moving with sparks, reserving recoil and hit-stop for a real hit', () => {
  const { figure, draw, hitStop, burst } = setup();
  try {
    figure.struck(1, 0, 1, true, 0.4);
    draw(ActionKind.Charge, 4);
    expect(figure.character.group.position.x).toBe(0);
    expect(burst.mock.calls[0]![0]).toBe('spark');
    expect(audio.clank).toHaveBeenCalledWith(0.4);
    expect(hitStop).not.toHaveBeenCalled();
    figure.struck(1, 0, 1, false, 0.4);
    draw(ActionKind.Flinch, 0);
    expect(figure.character.group.position.x).toBeGreaterThan(0);
    expect(burst.mock.calls[1]![0]).toBe('bone');
    expect(hitStop).toHaveBeenCalledWith(0.06);
    figure.struck(1, 0, 1.5, false);
    expect(hitStop).toHaveBeenLastCalledWith(0.12);
  } finally {
    figure.dispose();
  }
});

it('hides an interrupted or departing warning and removes it when the body is pooled', () => {
  const { figure, draw, parent } = setup();
  draw(ActionKind.Windup, 5);
  const warning = parent.getObjectByName('raider-attack-warning')!;
  expect(warning.visible).toBe(true);
  figure.depart();
  expect(warning.visible).toBe(false);
  figure.retire();
  expect(parent.children).toHaveLength(0);
});

it('includes the warning in the out-of-sight loading rehearsal, then clears it for play', () => {
  const { figure, draw, parent } = setup();
  try {
    figure.showEverythingAt(2, -40, 3);
    const warning = parent.getObjectByName('raider-attack-warning')!;
    expect(warning.position.toArray()).toEqual([2, -40, 3]);
    expect(warning.visible).toBe(true);
    expect(warning.children.every((mesh) => mesh.visible && !mesh.frustumCulled)).toBe(true);
    draw(ActionKind.Idle, 0);
    expect(warning.visible).toBe(false);
  } finally {
    figure.dispose();
  }
});

it('keeps the king moving through armored hits and leaves Soul Storm to its own warnings', () => {
  const { figure, draw, hitStop, parent } = setup('hollowKing');
  try {
    figure.struck(1, 0, 1.5, true);
    expect(hitStop).not.toHaveBeenCalled();
    draw(ActionKind.Charge, 25);
    const warning = parent.getObjectByName('raider-attack-warning')!;
    expect(warning.visible).toBe(true);
    figure.draw(
      1 / 60,
      { x: 0, y: 0, z: 0, yaw: 0 },
      {
        move: {
          kind: ActionKind.Charge,
          age: 25,
          step: 0,
          atTree: false,
          flinchVariant: 0,
          roll: 'forward',
        },
        locomotion: { speed: 0, airborne: false },
      },
      0,
      true,
    );
    expect(warning.visible).toBe(false);
  } finally {
    figure.dispose();
  }
});
