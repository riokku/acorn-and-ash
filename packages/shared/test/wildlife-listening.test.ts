import { expect, it } from 'vitest';
import {
  ANIMAL_KINDS,
  PREY_POSE,
  quietWildlifeListening,
  stepWildlifeListening,
  encodeSnapshot,
  decodeServerMessage,
  SnapshotFlag,
} from '../src/index';
const kind = ANIMAL_KINDS.rabbit;
const source = { id: 1, x: 4, z: 0, distance: 4, speed: 0 };

it('investigates a new presence briefly, remembers its location, and settles when nothing else happens', () => {
  let memory = stepWildlifeListening(quietWildlifeListening(), source, kind, 0.05);
  expect(memory.remaining).toBe(2.5);
  expect(memory.point).toEqual({ x: 4, z: 0 });
  memory = stepWildlifeListening(memory, { ...source, x: -4 }, kind, 1);
  expect(memory.point).toEqual({ x: 4, z: 0 });
  expect(memory.remaining).toBe(1.5);
  memory = stepWildlifeListening(memory, source, kind, 2);
  expect(memory.remaining).toBe(0);
  expect(stepWildlifeListening(memory, source, kind, 1).remaining).toBe(0);
});
it('refreshes on actual footfalls and sight, but never tracks unheard movement outside its range', () => {
  const heard = { ...source, speed: 4.5, distance: 6 };
  let memory = stepWildlifeListening(quietWildlifeListening(), heard, kind, 0.1);
  memory = stepWildlifeListening(memory, { ...heard, x: 5 }, kind, 0.1);
  expect(memory.point?.x).toBe(5);
  memory = stepWildlifeListening(memory, { ...heard, x: 30, distance: 30 }, kind, 0.5);
  expect(memory.point?.x).toBe(5);
  expect(memory.remaining).toBe(2);
  const seen = { ...source, distance: 2, x: 2 };
  expect(stepWildlifeListening(memory, seen, kind, 1).point?.x).toBe(2);
});
it('looks back toward an escape source, then forgets it; disappearing players cannot remain tracked', () => {
  const escape = { x: 10, z: -5 };
  let memory = stepWildlifeListening(quietWildlifeListening(), null, kind, 0.1, escape);
  escape.x = 99;
  expect(memory.point?.x).toBe(10);
  memory = stepWildlifeListening(memory, null, kind, 3);
  expect(memory.remaining).toBe(0);
  expect(memory.sourceId).toBeNull();
});
it('preserves prey warning bits through the existing snapshot without changing attack/alert bit values', () => {
  expect(PREY_POSE).toEqual({ tense: 16, fleeing: 32 });
  for (const action of [4 | PREY_POSE.tense, 4 | PREY_POSE.fleeing, 1 | 4, 2 | 4, 8]) {
    const entity = {
      netId: 1000,
      x: 0,
      y: 0,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      action,
      actionAge: 0,
      actionHeading: 0,
      flags: SnapshotFlag.Animal,
    };
    const message = decodeServerMessage(encodeSnapshot(1, 1000, 0, [entity]));
    expect(message?.type).toBe('snapshot');
    if (message?.type !== 'snapshot') throw new Error('Missing snapshot');
    expect(message.entities[0]?.action).toBe(action);
  }
});
