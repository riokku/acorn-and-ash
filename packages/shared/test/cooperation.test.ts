import { afterEach, expect, it } from 'vitest';
import { WorldSimulation } from '../src/sim/world-sim';
import { ActionKind } from '../src/sim/actions';
import { createInput, PlayerButton } from '../src/sim/player';
import { RESCUE } from '../src/sim/cooperation';
import { decodeServerMessage, encodeAllies } from '../src/net/protocol';

const sims: WorldSimulation[] = [];
afterEach(() => sims.splice(0).forEach((s) => s.dispose()));
function party(second = true) {
  const sim = new WorldSimulation({
    seed: 1234,
    hungerEmptyAfterSeconds: Infinity,
    raidIntervalSeconds: Infinity,
  });
  sims.push(sim);
  sim.addPlayer(1, undefined, 'one');
  if (second) sim.addPlayer(2, undefined, 'two');
  sim.placePlayer(1, { x: 0, y: 0, z: 0 }, 0);
  if (second) sim.placePlayer(2, { x: 1.8, y: 0, z: 0 }, 0);
  // Exercise the real damage/knockout path, without waiting for wildlife AI.
  const strike = (id: number, damage: number) =>
    (
      sim as unknown as { raiderStrikesPlayer(id: number, damage: number, tick: number): void }
    ).raiderStrikesPlayer(id, damage, sim.tick);
  let seq = 0;
  const step = (n = 1, buttons = 0, moveX = 0) => {
    for (let i = 0; i < n; i++) {
      if (second) sim.queueInput(2, createInput(++seq, moveX, 0, 0, buttons));
      sim.step(100000 + sim.tick * 50);
    }
  };
  return { sim, strike, step };
}
it('gives nearby allies a 15-second rescue window and revives after a continuous three-second hold', () => {
  const { sim, strike, step } = party();
  strike(1, 1000);
  expect(sim.alliesOf(2).find((p) => p.netId === 1)?.downTicks).toBe(RESCUE.windowTicks);
  step(59, PlayerButton.Interact);
  expect(sim.actionOf(1)?.kind).toBe(ActionKind.KnockedOut);
  expect(sim.alliesOf(2).find((p) => p.netId === 1)?.rescueTicks).toBe(59);
  step(1, PlayerButton.Interact);
  expect(sim.actionOf(1)?.kind).toBe(ActionKind.Rise);
  expect(sim.healthOf(1)).toBe(35);
  expect(sim.alliesOf(1).find((p) => p.netId === 1)?.downTicks).toBe(0);
  expect(sim.snapshotFor(1).find((p) => p.netId === 1)?.x).toBeCloseTo(0, 0);
});
it('release, movement, a hit and missing inputs interrupt the channel rather than banking progress', () => {
  const { sim, strike, step } = party();
  strike(1, 1000);
  step(25, PlayerButton.Interact);
  step();
  expect(sim.alliesOf(2).find((p) => p.netId === 1)?.rescueTicks).toBe(0);
  step(25, PlayerButton.Interact);
  strike(2, 1);
  expect(sim.alliesOf(2).find((p) => p.netId === 1)?.rescueTicks).toBe(0);
  step(20);
  step(10, PlayerButton.Interact, 1);
  expect(sim.actionOf(1)?.kind).toBe(ActionKind.KnockedOut);
  step(5);
  step(10, PlayerButton.Interact);
  for (let i = 0; i < 6; i++) sim.step(200000 + i * 50);
  expect(sim.alliesOf(2).find((p) => p.netId === 1)?.rescueTicks).toBe(0);
});
it('keeps the existing solo wake-up, expires failed rescues, and never reveals distant or indoor allies', () => {
  const solo = party(false);
  solo.strike(1, 1000);
  solo.step(40);
  expect(solo.sim.actionOf(1)?.kind).toBe(ActionKind.Rise);
  const { sim, strike, step } = party();
  strike(1, 1000);
  step(300);
  expect(sim.actionOf(1)?.kind).toBe(ActionKind.Rise);
  sim.placePlayer(2, { x: 100, y: 0, z: 100 }, 0);
  expect(sim.alliesOf(1).map((p) => p.netId)).not.toContain(2);
  sim.placePlayer(2, { x: 0, y: 0, z: 0 }, 0, 123);
  expect(sim.alliesOf(2)).toEqual([]);
});
it('round-trips cooperative state and rejects truncation or impossible rescue values', () => {
  const { sim, strike } = party();
  strike(1, 1000);
  const players = sim.alliesOf(2),
    packet = encodeAllies(players);
  expect(new Uint8Array(packet)[0]).toBe(0x4b);
  expect(decodeServerMessage(packet)).toEqual({ type: 'allies', players });
  expect(decodeServerMessage(packet.slice(0, -1))).toBeNull();
  const invalid = encodeAllies([{ ...players[0]!, downTicks: 65535 }]);
  expect(decodeServerMessage(invalid)).toBeNull();
});
