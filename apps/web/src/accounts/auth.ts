import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { anonymous } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/d1';

import type { WebEnv } from '../env';
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
 * A guest stays signed in for a year, and each visit more than a day after the
 * last one pushes that year back. The browser only ever holds the session
 * cookie. The player key the worlds use is looked up here, on the server.
 */
export function createAuth(env: WebEnv, origin: string) {
  if (!env.BETTER_AUTH_SECRET) throw new AccountsNotConfiguredError();

  return betterAuth({
    baseURL: origin,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(drizzle(env.DB, { schema }), { provider: 'sqlite', schema }),
    plugins: [
      anonymous({
        // Better Auth wants an email for every account; a guest has none.
        emailDomainName: 'guest.acorn-and-ash.invalid',
        generateName: () => 'Guest',
      }),
    ],
    user: {
      additionalFields: {
        playerKey: { type: 'string', required: false, input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Every account, guest or not, starts with a key of its own.
          before: async (user) => ({ data: { ...user, playerKey: newPlayerKey() } }),
        },
      },
    },
    session: { expiresIn: 365 * SECONDS_PER_DAY, updateAge: SECONDS_PER_DAY },
    advanced: { cookiePrefix: 'acorn' },
  });
}

export type Auth = ReturnType<typeof createAuth>;
