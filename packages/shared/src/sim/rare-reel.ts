import { TICK_HZ } from '../constants';
import type { CastInput } from './fishing';
export const REEL_CYCLE = 2 * TICK_HZ;
export const REEL_LIMIT = 8 * TICK_HZ;
export interface ReelView {
  age: number;
  hits: number;
  misses: number;
}
export interface RareReel extends ReelView {
  firstSeq: number | null;
  lastSeq: number;
  wonCycle: number;
  giveUpTick: number;
}
export function startRareReel(tick: number): RareReel {
  return {
    age: 0,
    hits: 0,
    misses: 0,
    firstSeq: null,
    lastSeq: -1,
    wonCycle: -1,
    giveUpTick: tick + 20 * TICK_HZ,
  };
}
/** A broad steady interval, with additional input grace around its edges. */
export function reelSteady(age: number): boolean {
  const phase = age % REEL_CYCLE;
  return phase >= 12 && phase <= 34;
}
export function readRareReel(reel: RareReel, input: CastInput): 'caught' | 'tooLate' | null {
  // Wait for the browser to acknowledge the new phase. Old bite inputs cannot consume the challenge.
  if (input.sawBite || input.seq <= reel.lastSeq) return null;
  if (reel.firstSeq === null) reel.firstSeq = input.seq;
  reel.lastSeq = input.seq;
  reel.age = Math.min(0xffff, input.seq - reel.firstSeq);
  if (reel.age > REEL_LIMIT) return 'tooLate';
  if (!input.clicked) return null;
  const cycle = Math.floor(reel.age / REEL_CYCLE),
    phase = reel.age % REEL_CYCLE;
  if (cycle === reel.wonCycle) return null;
  if (phase >= 8 && phase <= 38) {
    reel.hits++;
    reel.wonCycle = cycle;
  } else reel.misses++;
  return reel.hits >= 2 ? 'caught' : reel.misses >= 3 ? 'tooLate' : null;
}
