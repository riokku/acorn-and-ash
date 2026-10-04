import { betterAuth, type BetterAuthOptions } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/d1';

import type { WebEnv } from '../env';
import { offeredProviders } from './options';
import { newPlayerKey } from './player-key';
import * as schema from './schema';

const SECONDS_PER_DAY = 60 * 60 * 24;

/** Raised when a deployed environment has not been given its session secret. */
export class AccountsNotConfiguredError extends Error {
  constructor() {
    super('The session secret (BETTER_AUTH_SECRET) has not been set for this environment.');
  }
}

/**
 * Better Auth, wired to the accounts database in D1.
 *
 * Made fresh for each request because it needs that request's bindings and
 * address; building it is cheap, and nothing is kept between requests.
 *
 * Players sign in with Google or Discord, and only with the ones this
 * environment was given credentials for. Whoever signs in with either, using an
 * email the service has verified, and has signed in with the other before, is
 * the same account, so they still have just the one character. Signed in, a
 * player stays so for a year, and each visit more than a day after the last one
 * pushes that year back. The browser only ever holds the session cookie. The
 * player key the worlds use is looked up here, on the server.
 *
 * The test player plugin is always loaded so its types are, but nothing reaches
 * it except the test sign-in route, which refuses outside test addresses.
 */
export function createAuth(env: WebEnv, origin: string) {
  if (!env.BETTER_AUTH_SECRET) throw new AccountsNotConfiguredError();

  const offered = offeredProviders(env, new URL(origin).hostname);
  const socialProviders: NonNullable<BetterAuthOptions['socialProviders']> = {};
  if (offered.includes('google') && env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    socialProviders.google = {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Many people are signed in to more than one Google account.
      prompt: 'select_account',
    };
  }
  if (offered.includes('discord') && env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) {
    socialProviders.discord = {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
    };
  }

  return betterAuth({
    baseURL: origin,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: 'sqlite', schema }),
    socialProviders,
    account: {
      // Google always verifies the email it hands over. Discord says whether it
      // did, and a Discord email it did not verify is never trusted to join up
      // with somebody else's account.
      accountLinking: { enabled: true, trustedProviders: ['google'] },
    },
    plugins: [
      anonymous({
        // Better Auth wants an email for every account; a test player has none.
        emailDomainName: 'test.acorn-and-ash.invalid',
        generateName: () => 'Test player',
      }),
    ],
    user: {
      additionalFields: {
        playerKey: { type: 'string', required: false, input: false },
        enteredAt: { type: 'date', required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Every account starts with a key of its own.
          before: async (user) => ({ data: { ...user, playerKey: newPlayerKey() } }),
        },
      },
    },
    session: { expiresIn: 365 * SECONDS_PER_DAY, updateAge: SECONDS_PER_DAY },
    advanced: { cookiePrefix: 'acorn' },
  });
}

export type Auth = ReturnType<typeof createAuth>;
