import {
  SignInError,
  fetchSavedCharacter,
  fetchSessionStatus,
  resumeAccount,
  signInAsTestPlayer,
  type SessionStatus,
} from '../net/account';
import type { PlayerIdentity } from './identity';

/** What the player should see first, once the site has said who they are. */
export type Entrance =
  | { readonly kind: 'sign-in'; readonly status: SessionStatus }
  | {
      readonly kind: 'home';
      readonly accountName: string;
      /** The character they already made in this world, if they have. */
      readonly saved: PlayerIdentity | null;
    };

/**
 * Work out the first screen: sign in if nobody is, otherwise their Home screen,
 * showing the character they already have when they have one.
 *
 * Where test sign-in is automatic (your own machine, the browser tests) a test
 * player is made on the spot, so there is no sign-in screen to get past.
 */
export async function findEntrance(
  storage: Storage,
  worldId: string,
  send: typeof fetch = (input, init) => fetch(input, init),
): Promise<Entrance> {
  let status = await fetchSessionStatus(send);

  if (!status.signedIn && status.testSignIn === 'automatic') {
    await signInAsTestPlayer(send);
    status = await fetchSessionStatus(send);
  }
  if (!status.signedIn) return { kind: 'sign-in', status };

  try {
    status = await resumeAccount(storage, send);
    const saved = await fetchSavedCharacter(worldId, send);
    return { kind: 'home', accountName: status.name ?? 'Player', saved };
  } catch (error) {
    // The session ended between asking and answering: start from the sign-in.
    if (error instanceof SignInError && error.status === 401) {
      return { kind: 'sign-in', status: { ...status, signedIn: false, name: null } };
    }
    throw error;
  }
}
