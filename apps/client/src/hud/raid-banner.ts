import type { RaidNews } from '@acorn/shared';

import type { RaidBanner } from './store';

/**
 * The words on a raid banner (see decision 0063): who it is after, how many
 * and which way when it turns up, and how it ended.
 *
 * `targetName` is null for a raid on us, or the name of whoever it is after.
 * `bearingDegrees` is which way the raid is from us, relative to the camera
 * (see `compassTo`), or null if there is no telling. `key` is new for every
 * banner, so one replacing another plays in again from the start.
 */
export function raidBannerFor(
  news: RaidNews,
  targetName: string | null,
  bearingDegrees: number | null,
  key: number,
): RaidBanner {
  switch (news.kind) {
    case 'incoming': {
      const many = news.count === 1 ? 'skeleton' : 'skeletons';
      const how = `${countWord(news.count)} ${many}`;
      const where = bearingDegrees === null ? '' : `, ${directionWords(bearingDegrees)}`;
      return {
        key,
        tone: 'danger',
        title:
          targetName === null
            ? 'Skeleton raid!'
            : news.count === 1
              ? `A skeleton is after ${targetName}!`
              : `Skeletons are after ${targetName}!`,
        detail: `${how}${where}`,
      };
    }
    case 'wanderer':
    case 'ruins':
    case 'patrol':
      return {
        key,
        tone: 'danger',
        title:
          news.kind === 'wanderer'
            ? 'A skeleton spotted you'
            : news.kind === 'ruins'
              ? 'The ruins are guarded'
              : 'Night patrol!',
        detail:
          news.kind === 'wanderer'
            ? 'Fight or retreat toward home'
            : `${countWord(news.count)} skeletons · retreat to leave them behind`,
      };
    case 'encounterCleared':
      return {
        key,
        tone: 'victory',
        title: 'The glade is quiet again',
        detail: 'Collect your finds and head home',
      };
    case 'foughtOff':
      return {
        key,
        tone: 'victory',
        title: 'Raid fought off!',
        detail: news.count === 1 ? 'It left a bone behind' : 'They left bones behind',
      };
    case 'gaveUp':
      return {
        key,
        tone: 'calm',
        title: 'The raid is over',
        detail:
          news.count === 0
            ? 'The skeletons went back into the woods'
            : `${countWord(news.count)} beaten · the rest went back into the woods`,
      };
  }
}

/** Which way something is, in words, from a bearing relative to the camera: 0 ahead, positive to the right. */
export function directionWords(bearingDegrees: number): string {
  const turn = Math.abs(bearingDegrees);
  if (turn <= 35) return 'ahead of you';
  if (turn >= 135) return 'behind you';
  return bearingDegrees > 0 ? 'to your right' : 'to your left';
}

function countWord(count: number): string {
  return ['None', 'One', 'Two', 'Three', 'Four'][count] ?? String(count);
}
