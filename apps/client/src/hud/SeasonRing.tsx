import { SeasonIcon } from './SeasonIcon';
import { ringPoint, ringSegments, seasonMiddleDegrees } from './season-ring';
import type { SeasonBannerView } from './season-banner';

/** The ring's size, in the same pixels as the minimap it goes round (188 across). */
const SIZE = 200;
const CENTRE = SIZE / 2;
/** Just outside the minimap's own rim: the ring runs from radius 94 to 99. */
const RADIUS = 96.5;
/** How far from the middle the badge sits: its edge just touches the outside of the ring. */
const BADGE_RADIUS = 113;
const BADGE_SIZE = 26;

/**
 * The year, as a ring around the minimap (decision 0110). One piece for each
 * day of the year, filling clockwise from the top: spring, summer, autumn and
 * winter in their own colours, six days each. Days gone are bright, today pulses
 * gently, days to come are dim. A round badge outside the ring, in the middle
 * of the current season's quarter, shows that season's icon. Hovering the badge
 * or the ring says it in words with the day.
 *
 * It sits just outside the map's rim, so none of the map is covered. Where it
 * goes is the minimap's business: it is drawn inside `.minimap`, so the two
 * always line up.
 */
export function SeasonRing({ view }: { readonly view: SeasonBannerView }): React.JSX.Element {
  const segments = ringSegments(view.dayOfYear, RADIUS, CENTRE);
  const badge = ringPoint(BADGE_RADIUS, seasonMiddleDegrees(view.seasonIndex), CENTRE);
  const words = `${view.seasonName}, day ${view.day} of ${view.daysInSeason}`;
  return (
    <div
      className={`season-ring season-ring-${view.season}`}
      role="img"
      aria-label={words}
      data-testid="season-ring"
      data-season={view.season}
    >
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} focusable="false">
        <circle className="season-ring-track" cx={CENTRE} cy={CENTRE} r={RADIUS} />
        {segments.map((segment) => (
          <path
            key={segment.day}
            d={segment.path}
            className={`season-ring-day season-ring-day-${segment.season} is-${segment.state}`}
            data-day={segment.day}
            data-season={segment.season}
          />
        ))}
        <circle className="season-ring-hit" cx={CENTRE} cy={CENTRE} r={RADIUS} />
      </svg>
      <span
        className="season-ring-badge"
        aria-hidden="true"
        style={{ left: badge.x - BADGE_SIZE / 2, top: badge.y - BADGE_SIZE / 2 }}
      >
        <SeasonIcon season={view.season} />
      </span>
      <span className="season-ring-tip" aria-hidden="true">
        {view.seasonName} · Day {view.day} of {view.daysInSeason}
      </span>
    </div>
  );
}
