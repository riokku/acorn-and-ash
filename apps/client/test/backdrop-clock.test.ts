import { describe, expect, it } from 'vitest';

import { DAY_LENGTH_MS, DEFAULT_WORLD_SEED, SEASONS, calendarAt } from '@acorn/shared';

import { backdropSeasonMix, mixKey } from '../src/backdrop/backdrop-clock';

const NOW = Date.UTC(2026, 9, 6, 20, 0, 0);

describe('the season behind the front page', () => {
  it('follows the world’s own calendar', () => {
    const calendar = calendarAt(DEFAULT_WORLD_SEED, NOW);
    expect(backdropSeasonMix(NOW).from).toBe(calendar.season);
  });

  it('shows the first day of a season asked for with ?season=, in every season', () => {
    for (const season of SEASONS) {
      const mix = backdropSeasonMix(NOW, season);
      expect(mix.from).toBe(season);
      expect(mix.amount).toBe(0);
    }
  });

  it('eases into the next season over the last stretch of one', () => {
    // Walk through a whole year a day at a time and find a day that is mid-blend.
    let blending = 0;
    for (let day = 0; day < 24; day++) {
      const mix = backdropSeasonMix(NOW + day * DAY_LENGTH_MS);
      if (mix.amount > 0 && mix.amount < 1) blending += 1;
    }
    expect(blending).toBeGreaterThan(0);
  });
});

describe('the name of a look', () => {
  it('is the same for looks that cannot be told apart, and different for those that can', () => {
    const a = { from: 'autumn', to: 'winter', amount: 0.31 } as const;
    expect(mixKey(a)).toBe(mixKey({ ...a, amount: 0.33 }));
    expect(mixKey(a)).not.toBe(mixKey({ ...a, amount: 0.6 }));
    expect(mixKey(a)).not.toBe(mixKey({ ...a, from: 'spring' }));
  });
});
