import { describe, expect, it } from 'vitest';
import { vitalsThrob } from '../src/hud/vitals';

describe('the hunger and health bars throb when nearly empty', () => {
  it('keeps both quiet when you are fine', () => {
    expect(vitalsThrob(100, 100)).toEqual({ hunger: false, health: false });
  });

  it('throbs hunger below 10, not at 10', () => {
    expect(vitalsThrob(10, 100).hunger).toBe(false);
    expect(vitalsThrob(9.9, 100).hunger).toBe(true);
    expect(vitalsThrob(0, 100).hunger).toBe(true);
  });

  it('throbs health below 20, not at 20', () => {
    expect(vitalsThrob(100, 20).health).toBe(false);
    expect(vitalsThrob(100, 19.9).health).toBe(true);
    expect(vitalsThrob(100, 1).health).toBe(true);
  });

  it('keeps the two apart: being hungry does not make health throb', () => {
    expect(vitalsThrob(5, 80)).toEqual({ hunger: true, health: false });
    expect(vitalsThrob(80, 5)).toEqual({ hunger: false, health: true });
  });
});
