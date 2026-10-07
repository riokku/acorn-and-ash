import { SeasonIcon } from './SeasonIcon';
import { ringSegments } from './season-ring';
import type { SeasonBannerView } from './season-banner';

/** The ring's size, in the same pixels as the minimap it goes round (188 across). */
const SIZE = 200;
const CENTRE = SIZE / 2;
/** Just outside the minimap's own rim: the ring runs from radius 94 to 99. */
const RADIUS = 96.5;

/**
 * The season, as a ring around the minimap (decision 0110). One piece for each
 * day of the season, filling clockwise from the top: days gone are bright, today
 * pulses gently, days to come are dim. A round badge on the ring says which
 * season it is, and hovering it (or the ring) says it in words with the day.
 *
 * It sits just outside the map's rim, so none of the map is covered. Where it
 * goes is the minimap's business: it is drawn inside `.minimap`, so the two
 * always line up.
 */
export function SeasonRing({ view }: { readonly view: SeasonBannerView }): React.JSX.Element {
  const segments = ringSegments(view.daysInSeason, view.day, RADIUS, CENTRE);
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
            className={`season-ring-day is-${segment.state}`}
            data-day={segment.day}
          />
        ))}
        <circle className="season-ring-hit" cx={CENTRE} cy={CENTRE} r={RADIUS} />
      </svg>
      <span className="season-ring-badge" aria-hidden="true">
        <SeasonIcon season={view.season} />
        <span className="season-ring-tip">
          {view.seasonName} · Day {view.day} of {view.daysInSeason}
        </span>
      </span>
    </div>
  );
}
