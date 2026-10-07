import type { SeasonId } from '@acorn/shared';

/** A small picture for each season, drawn in the badge's own ink. */
export function SeasonIcon({ season }: { readonly season: SeasonId }): React.JSX.Element {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" focusable="false">
      {ICONS[season]}
    </svg>
  );
}

const ICONS: Record<SeasonId, React.JSX.Element> = {
  // A seedling: two leaves on a stem.
  spring: (
    <>
      <path d="M11 21v-8c-4 0-7-3-7-8 5 0 7 3 7 6 0-4 3-7 9-7 0 6-3 9-9 9v8z" />
    </>
  ),
  // A sun: a disc and eight rays.
  summer: (
    <>
      <circle cx="12" cy="12" r="4.6" />
      <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
        <path d="M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" />
      </g>
    </>
  ),
  // A leaf with its midrib and stalk.
  autumn: (
    <>
      <path d="M20 3c-9 0-15 4-15 11 0 1.4.3 2.6.8 3.6L3 21l1.5.5 2.3-2.6c1 .5 2.2.7 3.4.7 7 0 10-6 9.8-16.6z" />
      <path
        d="M6.6 17.4C9 12.6 12.4 9.2 17 7"
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </>
  ),
  // A snowflake: three crossing arms with little barbs.
  winter: (
    <g stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
      <path d="M12 2.5v19M3.8 7.2l16.4 9.6M20.2 7.2L3.8 16.8" />
      <path d="M9.5 4.2L12 6.4l2.5-2.2M9.5 19.8L12 17.6l2.5 2.2" />
    </g>
  ),
};
