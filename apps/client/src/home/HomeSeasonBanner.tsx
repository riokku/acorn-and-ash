import { useEffect, useState } from 'react';

import { backdropCalendar } from '../backdrop/backdrop-clock';
import { SeasonBanner } from '../hud/SeasonBanner';
import { seasonBannerView } from '../hud/season-banner';
import { readSettings } from '../settings';

/** How often to look at the calendar again. A day is twenty minutes, so once a minute is plenty. */
const REFRESH_MS = 60_000;

/**
 * The season banner on the front page and the character screen (decision 0110).
 *
 * Nobody is connected yet, so this reads the same calendar the painted backdrop
 * behind it follows, and the banner and the picture agree. `?season=` shows a
 * season on purpose, as it does in the game and for the backdrop.
 */
export function HomeSeasonBanner({
  className = '',
}: {
  readonly className?: string;
}): React.JSX.Element {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);
  const forced = readSettings(window.location.search).season;
  const view = seasonBannerView(backdropCalendar(now, forced));
  return <SeasonBanner view={view} className={`home-season-banner ${className}`.trim()} />;
}
