import { afterEach, describe, expect, it } from 'vitest';
import {
  ANIMAL_DENS,
  DEFAULT_WORLD_SEED,
  WorldSimulation,
  characterStats,
  statsWithItem,
} from '../src/index';
const worlds: WorldSimulation[] = [];
afterEach(() => worlds.splice(0).forEach((sim) => sim.dispose()));
function world() {
  const sim = new WorldSimulation({ seed: DEFAULT_WORLD_SEED });
  worlds.push(sim);
  sim.addPlayer(1);
  sim.giveTestGear(1, ['ironSword', 'huntingKnife', 'axe', 'refinedAxe']);
  return sim;
}
describe('equipment power', () => {
  it('uses the active hand rather than a holstered weapon or off-hand knife', () => {
    expect(characterStats({ mainHand: 'ironSword' }).power).toBe(150);
    expect(characterStats({ mainHand: 'ironSword' }, 'axe').power).toBe(100);
    expect(characterStats({ mainHand: 'ironSword' }, 'refinedAxe').power).toBe(125);
    expect(characterStats({ offHand: 'huntingKnife' }, 'axe').power).toBe(100);
    expect(characterStats({ mainHand: 'ironSword' }, 'berry').power).toBe(100);
    expect(characterStats({}, null).power).toBe(100);
  });
  it('compares the slot that right-click actually chooses, without mutating worn gear', () => {
    const worn = { mainHand: 'ironSword' } as const;
    expect(statsWithItem(worn, 'ironSword', 'huntingKnife').power).toBe(150);
    expect(statsWithItem(worn, 'axe', 'ironSword').power).toBe(150);
    expect(statsWithItem(worn, 'ironSword', 'huntingKnife', 'mainHand').power).toBe(125);
    expect(worn).toEqual({ mainHand: 'ironSword' });
  });
  it('makes a worn sword stronger against wildlife while a selected axe keeps its baseline', () => {
    const sim = world();
    const target = ANIMAL_DENS.find((animal) => animal.kind === 'maskedRaccoon')!;
    expect(target).toBeDefined();
    sim.wearGear(1, 'ironSword', 'mainHand');
    const internal = sim as unknown as {
      players: Map<number, unknown>;
      catchAnimal(runtime: unknown, id: number, charged: boolean): void;
    };
    internal.catchAnimal(internal.players.get(1), target.id, false);
    expect(sim.drainThreatHitEvents().at(-1)?.hitsLeft).toBe(2);
    internal.catchAnimal(internal.players.get(1), target.id, false);
    expect(sim.drainCatchEvents().at(-1)?.netId).toBe(1);
    const baseline = world();
    const other = ANIMAL_DENS.find((animal) => animal.kind === 'maskedRaccoon')!;
    baseline.wearGear(1, 'ironSword', 'mainHand');
    baseline.useItem(1, 'axe');
    const ordinary = baseline as unknown as typeof internal;
    ordinary.catchAnimal(ordinary.players.get(1), other.id, false);
    ordinary.catchAnimal(ordinary.players.get(1), other.id, false);
    expect(baseline.drainThreatHitEvents().at(-1)?.hitsLeft).toBe(1);
    expect(baseline.drainCatchEvents()).toHaveLength(0);
  });
});
