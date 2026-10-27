import type { BuildableKindId } from '@acorn/shared';
/** Existing earned objects, with the adventures that make them worth displaying. */
export const KEEPSAKES = [
  {
    kind: 'guardianTrophy',
    title: 'The forest remembers',
    story: 'A branch crown earned by overcoming the woodland guardian.',
    route: 'Help defeat the guardian, then collect your trophy at the guardian hollow.',
  },
  {
    kind: 'sentinelTrophy',
    title: 'A crown from the ruins',
    story: 'The ruin sentinel’s crown marks a hard-won victory.',
    route: 'Defeat the ruin sentinel and bring home the personal trophy from your first victory.',
  },
  {
    kind: 'lastBellTrophy',
    title: 'When the last bell fell silent',
    story: 'A keepsake of the watch captain and the danger beneath Bonehollow’s bell.',
    route: 'Complete the Bonehollow outing at your home board and claim its keepsake.',
  },
  {
    kind: 'firstBellRelic',
    title: 'We stood against the king',
    story: 'The First Bell relic remembers a stand against the Hollow King.',
    route:
      'Contribute to defeating the Hollow King and collect your personal relic after the battle.',
  },
  {
    kind: 'sunreachPennant',
    title: 'Beyond the mountain pass',
    story: 'A pennant brought home from the high plains.',
    route: 'Complete the Sunreach survey outing and claim its reward at your home board.',
  },
  {
    kind: 'fishDisplay',
    title: 'An angler’s first chapter',
    story: 'A timber fish display celebrating five catches.',
    route: 'Catch five fish to learn this display recipe, then bring its building materials home.',
  },
  {
    kind: 'goldenFishDisplay',
    title: 'Every shimmer in the lake',
    story: 'A golden display celebrating perch, trout and golden carp.',
    route: 'Catch each of the three fish species to learn this collection display recipe.',
  },
  {
    kind: 'trailPennant',
    title: 'A home between adventures',
    story: 'Stories gathered far from home, remembered beside the door.',
    route:
      'Recover your first rumor bundle, or complete three ordinary outings, to learn the trail pennant recipe.',
  },
] as const satisfies readonly {
  kind: BuildableKindId;
  title: string;
  story: string;
  route: string;
}[];
export type KeepsakeKind = (typeof KEEPSAKES)[number]['kind'];
export function isKeepsake(kind: BuildableKindId): kind is KeepsakeKind {
  return KEEPSAKES.some((keepsake) => keepsake.kind === kind);
}
