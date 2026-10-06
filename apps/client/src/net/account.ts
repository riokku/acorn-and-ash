/**
 * Being somebody the world remembers.
 *
 * Players sign in with Google or Discord (decision 0086). After that a cookie
 * says who they are: the world server looks the player up from it, and the
 * browser never holds the key a world saves its character under. Everything
 * here is a question put to the site; the answers are checked again by the
 * server every time, never trusted from here.
 */

import {
  CHARACTER_KINDS,
  TINT_COLORS,
  isValidPlayerName,
  sanitizePlayerName,
  type CharacterId,
  type TintColorId,
} from '@acorn/shared';

import type { PlayerIdentity } from '../home/identity';

/** The login services a player can use. */
export type Provider = 'google' | 'discord';

const PROVIDER_NAMES: Record<Provider, string> = { google: 'Google', discord: 'Discord' };

/** The name of a login service as a player knows it. */
export function providerName(provider: Provider): string {
  return PROVIDER_NAMES[provider];
}

/** Where a "Continue with…" button goes: off to the login service, then back here. */
export function loginPath(provider: Provider): string {
  return `/api/login/${provider}`;
}

/** What the site says about this browser before anything is shown. */
export interface SessionStatus {
  readonly signedIn: boolean;
  /** What the account is called at the login service. Only ever shown back to them. */
  readonly name: string | null;
  /** The login services that are set up here. Empty until they have been. */
  readonly providers: readonly Provider[];
  /**
   * How a test player gets in, on your own machine and on previews, where
   * Google and Discord cannot work: `automatic` needs no screen at all.
   */
  readonly testSignIn: 'automatic' | 'button' | null;
}

/**
 * Where browsers kept their key before accounts existed. It is still read once,
 * so a character made then carries on under the account that replaces it
 * instead of starting again. Nothing writes it any more.
 */
const EARLIER_KEY_STORAGE = 'acorn.playerKey';
const KEY_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** The key this browser played under before accounts, if it ever did. */
export function earlierPlayerKey(storage: Storage): string | null {
  try {
    const key = storage.getItem(EARLIER_KEY_STORAGE);
    return key !== null && KEY_PATTERN.test(key) ? key : null;
  } catch {
    // Storage can be switched off entirely; that is a browser with no history.
    return null;
  }
}

/** Raised when the site would not let this browser sign in, or says it no longer is. */
export class SignInError extends Error {
  constructor(readonly status: number) {
    super(
      status === 429
        ? 'Too many sign-in attempts from this connection. Try again in a minute'
        : status === 401
          ? 'You are not signed in'
          : `Could not sign in (${status})`,
    );
  }
}

type Send = typeof fetch;
const sendNormally: Send = (input, init) => fetch(input, init);

function parseStatus(raw: unknown): SessionStatus {
  const body = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const providers = Array.isArray(body.providers)
    ? body.providers.filter((p): p is Provider => p === 'google' || p === 'discord')
    : [];
  return {
    signedIn: body.signedIn === true,
    name: typeof body.name === 'string' ? body.name : null,
    providers,
    testSignIn:
      body.testSignIn === 'automatic' || body.testSignIn === 'button' ? body.testSignIn : null,
  };
}

/** Who, if anyone, is signed in, and what they could sign in with. */
export async function fetchSessionStatus(send: Send = sendNormally): Promise<SessionStatus> {
  const response = await send('/api/session', { credentials: 'same-origin' });
  if (!response.ok) throw new SignInError(response.status);
  return parseStatus(await response.json());
}

/**
 * Say "I'm here" as the signed-in player. A browser that played before accounts
 * existed hands over its old key, once, so that character carries on under the
 * account instead of starting again. Safe to repeat, and done before every
 * connection: a session that has ended is found out here, not by a connection
 * that quietly fails.
 */
export async function resumeAccount(
  storage: Storage,
  send: Send = sendNormally,
): Promise<SessionStatus> {
  const earlierKey = earlierPlayerKey(storage);
  const response = await send('/api/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(earlierKey === null ? {} : { earlierKey }),
    credentials: 'same-origin',
  });
  if (!response.ok) throw new SignInError(response.status);
  return parseStatus(await response.json());
}

/** Sign in as a test player. Only works where the site allows it. */
export async function signInAsTestPlayer(send: Send = sendNormally): Promise<void> {
  const response = await send('/api/test-sign-in', {
    method: 'POST',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new SignInError(response.status);
}

/**
 * Let the player go. Rejects when the site could not be reached or did not
 * agree, so the game can say so rather than land the player back on a screen
 * that still has them signed in (decision 0104).
 */
export async function signOut(send: Send = sendNormally): Promise<void> {
  const response = await send('/api/sign-out', { method: 'POST', credentials: 'same-origin' });
  if (!response.ok) throw new Error(`Signing out failed (${response.status})`);
}

/**
 * The character this player made in this world, or null if they have not made
 * one yet. What the server says here is the only truth: a world keeps one
 * character per player and does not change it afterwards (decision 0087).
 */
export async function fetchSavedCharacter(
  worldId: string,
  send: Send = sendNormally,
): Promise<PlayerIdentity | null> {
  const response = await send(`/api/worlds/${encodeURIComponent(worldId)}/character`, {
    credentials: 'same-origin',
  });
  if (!response.ok) throw new SignInError(response.status);

  const body: unknown = await response.json();
  if (typeof body !== 'object' || body === null) return null;
  const { made, name, character, color } = body as Record<string, unknown>;
  if (made !== true || typeof name !== 'string') return null;

  const cleaned = sanitizePlayerName(name);
  if (!isValidPlayerName(cleaned)) return null;
  if (typeof character !== 'string' || !(character in CHARACTER_KINDS)) return null;
  if (typeof color !== 'string' || !(color in TINT_COLORS)) return null;
  return { name: cleaned, character: character as CharacterId, color: color as TintColorId };
}
