import { Group } from 'three/webgpu';
import { afterEach, expect, it, vi } from 'vitest';
import {
  ActionKind,
  SnapshotFlag,
  createActionState,
  packActionByte,
  type SnapshotEntity,
} from '@acorn/shared';
import { RaiderCrowd } from '../src/scene/raiders';
import { RaiderFigure } from '../src/scene/raider-figure';
import type { Character, CharacterFrame } from '../src/scene/character';
import { ImpactBursts } from '../src/scene/impact-bursts';
afterEach(() => vi.restoreAllMocks());
const sample = (x: number, action: ActionKind = ActionKind.Idle): SnapshotEntity => ({
  netId: 1,
  x,
  y: 0,
  z: 0,
  vx: 3,
  vy: 0,
  vz: 0,
  yaw: 0,
  flags: SnapshotFlag.Moving,
  action: packActionByte({ ...createActionState(), kind: action }),
  actionAge: 2,
  actionHeading: 0,
});
it('uses visible snapshot travel for gait, holds idle during gaps, and supplies player-style footing', () => {
  const draw = vi.fn();
  const spare = { dispose: vi.fn() } as unknown as Character;
  // Only the crowd's driving contract is under test; the real figure/rig is checked in Chrome.
  const figure = {
    kind: 'minion',
    down: false,
    draw,
    retire: () => spare,
    bar: { setHealth: vi.fn(), setWanted: vi.fn() },
  } as unknown as RaiderFigure;
  vi.spyOn(RaiderFigure, 'create').mockReturnValue(figure);
  const bursts = new ImpactBursts();
  const height = (x: number) => x * 0.25;
  const crowd = new RaiderCrowd(new Group(), bursts, height);
  try {
    crowd.setList([{ id: 1, kind: 'minion', hitsLeft: 2 }]);
    crowd.ingest(1000, [sample(0)]);
    crowd.ingest(1100, [sample(0.3)]);
    crowd.update(0.05, null, null);
    let frame = draw.mock.lastCall![2] as CharacterFrame;
    expect(frame.locomotion.speed).toBeCloseTo(3);
    expect(frame.groundHeight).toBe(height);
    expect(frame.groundHeight!(4, 0, 0)).toBe(1);
    crowd.update(0.2, null, null);
    frame = draw.mock.lastCall![2] as CharacterFrame;
    expect(frame.locomotion.speed).toBe(0);
    // Holding location never suppresses or freezes combat actions.
    crowd.ingest(1400, [sample(0.3, ActionKind.Dodge)]);
    crowd.update(0.2, null, null);
    frame = draw.mock.lastCall![2] as CharacterFrame;
    expect(frame.move.kind).toBe(ActionKind.Dodge);
    expect(frame.move.age).toBeGreaterThan(2);
    expect(frame.locomotion.speed).toBe(0);
  } finally {
    crowd.dispose();
    bursts.dispose();
  }
});
