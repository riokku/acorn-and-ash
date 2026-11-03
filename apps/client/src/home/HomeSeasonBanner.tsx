import { useEffect, useState } from 'react';

import { backdropCalendar } from '../backdrop/backdrop-clock';
import { SeasonBanner } from '../hud/SeasonBanner';
import { seasonBannerView, type SeasonBannerView } from '../hud/season-banner';
import { readSettings } from '../settings';
import { SeasonHexBadge } from './SeasonHexBadge';

/** How often to look at the calendar again. A day is twenty minutes, so once a minute is plenty. */
const REFRESH_MS = 60_000;

/**
 * Today's season on the home screens (decision 0110).
 *
 * Nobody is connected yet, so this reads the same calendar the painted backdrop
 * behind it follows, and the season shown and the picture agree. `?season=` shows
 * a season on purpose, as it does in the game and for the backdrop. It leaves the
 * year out: that calendar comes from the browser's clock, not from a world.
 */
function useHomeSeasonView(): SeasonBannerView {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);
  const forced = readSettings(window.location.search).season;
  return seasonBannerView(backdropCalendar(now, forced), { showYear: false });
}

/** The season banner, hung in the corner of the home screens. */
export function HomeSeasonBanner({
  className = '',
}: {
  readonly className?: string;
}): React.JSX.Element {
  const view = useHomeSeasonView();
  return <SeasonBanner view={view} className={`home-season-banner ${className}`.trim()} />;
}

/** The hexagon season badge, for the front page under Play. */
export function HomeSeasonBadge(): React.JSX.Element {
  return <SeasonHexBadge view={useHomeSeasonView()} />;
}
