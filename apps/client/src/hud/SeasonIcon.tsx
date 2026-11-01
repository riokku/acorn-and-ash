import type { SeasonId } from '@acorn/shared';
import { SystemIcon } from './item-icons';

/** The season's painted symbol, sized for the badge. */
export function SeasonIcon({ season }: { readonly season: SeasonId }): React.JSX.Element {
  return <SystemIcon icon={season} />;
}
