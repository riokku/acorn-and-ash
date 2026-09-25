import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { Home } from './Home';
import type { PlayerIdentity } from './identity';

/**
 * Mounts the Home screen and returns a function that tears it down again,
 * once the player has picked a name and clicked play.
 */
export function mountHome(
  container: HTMLElement,
  initial: PlayerIdentity,
  onPlay: (identity: PlayerIdentity) => void,
): () => void {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <Home initial={initial} onPlay={onPlay} />
    </StrictMode>,
  );
  return () => root.unmount();
}
