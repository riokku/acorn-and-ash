import type { WebEnv } from '../env';

/** The login services a player can sign in with. */
export const PROVIDERS = ['google', 'discord'] as const;
export type Provider = (typeof PROVIDERS)[number];

export function isProvider(value: string): value is Provider {
  return (PROVIDERS as readonly string[]).includes(value);
}

/**
 * How a test player gets in: `automatic` signs in with no screen at all, for
 * your own machine and the browser tests; `button` shows a "test sign-in"
 * button, for pull request previews, where Google and Discord can't work.
 */
export type TestSignIn = 'automatic' | 'button';

/**
 * Where a test sign-in is ever allowed: your own machine, and the throwaway
 * address each pull request preview gets, which is the Worker's name with the
 * pull request's alias stuck on the front (`pr-95-acorn-ash-web-staging`).
 * The real staging and production addresses are the bare Worker name, so they
 * never match, even if the setting were set there by mistake.
 */
export function isTestHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.localhost')) {
    return true;
  }
  const firstLabel = hostname.split('.')[0] ?? '';
  return firstLabel.includes('-acorn-ash-web-');
}

/** Whether, and how, test players may sign in on this address. */
export function testSignInMode(env: WebEnv, hostname: string): TestSignIn | null {
  if (env.TEST_SIGN_IN !== 'automatic' && env.TEST_SIGN_IN !== 'button') return null;
  return isTestHost(hostname) ? env.TEST_SIGN_IN : null;
}

/**
 * The login services that can be used here: those that were given both their
 * id and their secret. Where test sign-in is on there are none, because a
 * preview's address is not one Google or Discord have been told about.
 */
export function offeredProviders(env: WebEnv, hostname: string): Provider[] {
  if (testSignInMode(env, hostname) !== null) return [];
  const offered: Provider[] = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) offered.push('google');
  if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) offered.push('discord');
  return offered;
}
