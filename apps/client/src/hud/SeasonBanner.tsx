import type { SeasonBannerView } from './season-banner';
import { SeasonIcon } from './SeasonIcon';

/**
 * The season banner (decision 0110), after the one in Northgard: a dark plaque
 * with a stripe in the season's colour along the top, a round badge, "Year 2 ·
 * Autumn" and a line of advice underneath. The stripe is cut into one piece for
 * each day of the season, so it also says how far through the season you are.
 *
 * Drawn the same way in the game and on the home screens. Where it sits is the
 * caller's business (`className`), so each place can pin it where it fits.
 */
export function SeasonBanner({
  view,
  className = '',
}: {
  readonly view: SeasonBannerView;
  readonly className?: string;
}): React.JSX.Element {
  const days = Array.from({ length: view.daysInSeason }, (_, index) => index + 1);
  return (
    <div
      className={`season-banner season-banner-${view.season} ${className}`.trim()}
      role="status"
      aria-label={`${view.title}, day ${view.day} of ${view.daysInSeason}. ${view.hint}`}
      data-testid="season-banner"
      data-season={view.season}
    >
      <div className="season-banner-days" aria-hidden="true">
        {days.map((day) => (
          <span
            key={day}
            className={
              day < view.day
                ? 'season-banner-day is-past'
                : day === view.day
                  ? 'season-banner-day is-today'
                  : 'season-banner-day'
            }
          />
        ))}
      </div>
      <span className="season-banner-badge" aria-hidden="true">
        <SeasonIcon season={view.season} />
      </span>
      <div className="season-banner-text" aria-hidden="true">
        {view.year === undefined ? (
          <p className="season-banner-title">
            <strong>{view.seasonName}</strong>
          </p>
        ) : (
          <p className="season-banner-title">
            <strong>Year {view.year}</strong>
            <span className="season-banner-dot"> · </span>
            <em>{view.seasonName}</em>
          </p>
        )}
        <p className="season-banner-hint">{view.hint}</p>
      </div>
    </div>
  );
}
