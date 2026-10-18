import { BONEHOLLOW_EXPEDITION_ID, expeditionComplete, type ExpeditionState } from '@acorn/shared';

/** Celebrate live progress, never a restored journey or an unrelated expedition. */
export function bonehollowVictory(before: ExpeditionState, after: ExpeditionState) {
  if (
    before.active !== BONEHOLLOW_EXPEDITION_ID ||
    after.active !== before.active ||
    before.cycle !== after.cycle
  )
    return null;
  const complete = expeditionComplete(after);
  if (complete && !expeditionComplete(before))
    return {
      title: 'The Last Bell falls silent',
      detail: 'Bonehollow expedition complete · Return to your home board for the Last Watch helm',
    };
  if ((before.progress[2] ?? 0) === 0 && (after.progress[2] ?? 0) > 0)
    return {
      title: 'Captain of the Last Bell defeated',
      detail: 'The captain has fallen · Finish your remaining watch objectives to earn the helm',
    };
  return null;
}
