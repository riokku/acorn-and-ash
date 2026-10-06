import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { FrontDoor, Trouble, type FrontDoorProps } from './FrontDoor';
import { Home } from './Home';
import type { PlayerIdentity } from './identity';
import type { Preferences } from '../preferences/preferences';

/** What the Home screen needs to know about who is signed in. */
export interface HomeAccount {
  readonly name: string;
  /** The character already made in this world, if there is one. */
  readonly saved: PlayerIdentity | null;
  readonly onSignOut: () => void;
}

/**
 * Mounts the Home screen and returns a function that tears it down again,
 * once the player has picked a name and clicked play.
 */
export function mountHome(
  container: HTMLElement,
  initial: PlayerIdentity,
  account: HomeAccount,
  onPlay: (identity: PlayerIdentity) => void,
  initialPreferences: Preferences,
  onSettingsChange: (preferences: Preferences) => void,
): () => void {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <Home
        initial={initial}
        saved={account.saved}
        accountName={account.name}
        onSignOut={account.onSignOut}
        onPlay={onPlay}
        initialPreferences={initialPreferences}
        onSettingsChange={onSettingsChange}
      />
    </StrictMode>,
  );
  return () => root.unmount();
}

/** Mounts the front page: the Play button, then Create account and Log in. */
export function mountFrontDoor(container: HTMLElement, props: FrontDoorProps): () => void {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <FrontDoor {...props} />
    </StrictMode>,
  );
  return () => root.unmount();
}

/** Mounts the "couldn't reach the game" screen. */
export function mountTrouble(
  container: HTMLElement,
  message: string,
  onRetry: () => void,
): () => void {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <Trouble message={message} onRetry={onRetry} />
    </StrictMode>,
  );
  return () => root.unmount();
}
