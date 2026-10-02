import { describe, expect, it } from 'vitest';

import type { RaidNews } from '@acorn/shared';

import { directionWords, raidBannerFor } from '../src/hud/raid-banner';

function news(kind: RaidNews['kind'], count: number): RaidNews {
  return { kind, raidId: 1, targetNetId: 7, count, x: 10, z: 20 };
}

describe('the raid banner', () => {
  it('warns of a raid on us: how many, and which way to look', () => {
    expect(raidBannerFor(news('incoming', 3), null, 170, 1)).toEqual({
      key: 1,
      tone: 'danger',
      title: 'Skeleton raid!',
      detail: 'Three skeletons, behind you',
    });
    expect(raidBannerFor(news('incoming', 1), null, -80, 2).detail).toBe(
      'One skeleton, to your left',
    );
  });

  it('names whoever a raid nearby is after', () => {
    expect(raidBannerFor(news('incoming', 2), 'Sam', 10, 1).title).toBe('Skeletons are after Sam!');
    expect(raidBannerFor(news('incoming', 1), 'Sam', 10, 1).title).toBe('A skeleton is after Sam!');
  });

  it('leaves the direction out when there is no telling', () => {
    expect(raidBannerFor(news('incoming', 2), null, null, 1).detail).toBe('Two skeletons');
  });

  it('celebrates a raid fought off, and points out the bones', () => {
    const banner = raidBannerFor(news('foughtOff', 2), null, null, 3);
    expect(banner.tone).toBe('victory');
    expect(banner.title).toBe('Raid fought off!');
    expect(banner.detail).toBe('They left bones behind');
    expect(raidBannerFor(news('foughtOff', 1), null, null, 3).detail).toBe('It left a bone behind');
  });

  it('says calmly when a raid is over without being beaten', () => {
    expect(raidBannerFor(news('gaveUp', 0), null, null, 4)).toMatchObject({
      tone: 'calm',
      title: 'The raid is over',
      detail: 'The skeletons went back into the woods',
    });
    expect(raidBannerFor(news('gaveUp', 1), null, null, 4).detail).toBe(
      'One beaten · the rest went back into the woods',
    );
  });
});

describe('which way something is, in words', () => {
  it('reads a bearing relative to the camera: 0 ahead, positive to the right', () => {
    expect(directionWords(0)).toBe('ahead of you');
    expect(directionWords(30)).toBe('ahead of you');
    expect(directionWords(90)).toBe('to your right');
    expect(directionWords(-90)).toBe('to your left');
    expect(directionWords(180)).toBe('behind you');
    expect(directionWords(-150)).toBe('behind you');
  });
});
