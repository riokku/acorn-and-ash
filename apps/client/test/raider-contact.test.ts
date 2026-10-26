import { afterEach, expect, it, vi } from 'vitest';
import { Group } from 'three/webgpu';
import { ActionKind, createActionState, packActionByte, type RaiderHit } from '@acorn/shared';
import { RaiderCrowd } from '../src/scene/raiders';
import { RaiderFigure } from '../src/scene/raider-figure';
import type { Character } from '../src/scene/character';
import { ImpactBursts } from '../src/scene/impact-bursts';

afterEach(() => vi.restoreAllMocks());

it('shows unpredicted confirmed contacts, consumes predictions once, and keeps other players distinct', () => {
  const struck = vi.fn();
  const figure = {
    kind: 'minion',
    down: false,
    draw: vi.fn(),
    struck,
    retire: () => ({ dispose: vi.fn() }) as unknown as Character,
    bar: { setHealth: vi.fn(), setWanted: vi.fn() },
  } as unknown as RaiderFigure;
  vi.spyOn(RaiderFigure, 'create').mockReturnValue(figure);
  const bursts = new ImpactBursts();
  const crowd = new RaiderCrowd(new Group(), bursts);
  const origin = { x: 0, z: 1 };
  const hit: RaiderHit = { raiderId: 1, hitsLeft: 2, netId: 10, heavy: false, shrugged: false };
  try {
    crowd.setList([{ id: 1, kind: 'minion', hitsLeft: 3 }]);
    crowd.ingest(1000, [
      {
        netId: 1,
        x: 0,
        y: 0,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: 0,
        flags: 0,
        action: packActionByte({ ...createActionState(), kind: ActionKind.Idle }),
        actionAge: 0,
        actionHeading: 0,
      },
    ]);
    // A prediction before the figure exists must not suppress the real impact.
    crowd.predictBlow(1, origin, false, false);
    crowd.update(0.1, origin, null);
    crowd.confirmHit(hit, undefined, true, origin);
    expect(struck).toHaveBeenCalledTimes(1);
    crowd.predictBlow(1, origin, false, false);
    expect(struck).toHaveBeenCalledTimes(2);
    crowd.confirmHit(hit, origin, false, origin);
    expect(struck).toHaveBeenCalledTimes(3);
    crowd.confirmHit(hit, undefined, true, origin);
    expect(struck).toHaveBeenCalledTimes(3);
    crowd.confirmHit(hit, undefined, true, origin);
    expect(struck).toHaveBeenCalledTimes(4);
    crowd.predictBlow(1, origin, false, false);
    crowd.update(1.6, origin, null);
    crowd.confirmHit(hit, undefined, true, origin);
    expect(struck).toHaveBeenCalledTimes(6);
    crowd.predictBlow(1, origin, false, false);
    crowd.confirmHit({ ...hit, heavy: true }, undefined, true, origin);
    expect(struck).toHaveBeenCalledTimes(8);
  } finally {
    crowd.dispose();
    bursts.dispose();
  }
});
